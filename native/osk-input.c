#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <wayland-client.h>
#include <xkbcommon/xkbcommon.h>

#include "virtual-keyboard-unstable-v1-client-protocol.h"

struct backend {
  struct wl_seat *seat;
  struct zwp_virtual_keyboard_manager_v1 *manager;
};

static void registry_global(void *data, struct wl_registry *registry, uint32_t name,
                            const char *interface, uint32_t version) {
  struct backend *backend = data;
  if (strcmp(interface, wl_seat_interface.name) == 0) {
    uint32_t supported = version < 7 ? version : 7;
    backend->seat = wl_registry_bind(registry, name, &wl_seat_interface, supported);
  } else if (strcmp(interface, zwp_virtual_keyboard_manager_v1_interface.name) == 0) {
    backend->manager = wl_registry_bind(
      registry, name, &zwp_virtual_keyboard_manager_v1_interface, 1);
  }
}

static void registry_remove(void *data, struct wl_registry *registry, uint32_t name) {
  (void)data;
  (void)registry;
  (void)name;
}

static const struct wl_registry_listener registry_listener = {
  .global = registry_global,
  .global_remove = registry_remove,
};

static int write_all(int fd, const char *data, size_t size) {
  while (size > 0) {
    ssize_t written = write(fd, data, size);
    if (written < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    data += written;
    size -= (size_t)written;
  }
  return 0;
}

static int upload_keymap(struct zwp_virtual_keyboard_v1 *keyboard) {
  struct xkb_context *context = xkb_context_new(XKB_CONTEXT_NO_FLAGS);
  if (!context) return -1;

  const struct xkb_rule_names names = {
    .rules = "evdev",
    .model = "pc105",
    .layout = "us",
    .variant = "",
    .options = "",
  };
  struct xkb_keymap *keymap = xkb_keymap_new_from_names(
    context, &names, XKB_KEYMAP_COMPILE_NO_FLAGS);
  if (!keymap) {
    xkb_context_unref(context);
    return -1;
  }

  char *text = xkb_keymap_get_as_string(keymap, XKB_KEYMAP_FORMAT_TEXT_V1);
  if (!text) {
    xkb_keymap_unref(keymap);
    xkb_context_unref(context);
    return -1;
  }

  char path[] = "/tmp/omarchy-osk-keymap-XXXXXX";
  int fd = mkstemp(path);
  if (fd < 0) {
    free(text);
    xkb_keymap_unref(keymap);
    xkb_context_unref(context);
    return -1;
  }
  unlink(path);

  size_t size = strlen(text) + 1;
  int result = write_all(fd, text, size);
  if (result == 0) {
    lseek(fd, 0, SEEK_SET);
    zwp_virtual_keyboard_v1_keymap(
      keyboard, WL_KEYBOARD_KEYMAP_FORMAT_XKB_V1, fd, (uint32_t)size);
  }

  close(fd);
  free(text);
  xkb_keymap_unref(keymap);
  xkb_context_unref(context);
  return result;
}

static uint32_t event_time(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return 0;
  return (uint32_t)(now.tv_sec * 1000ULL + now.tv_nsec / 1000000ULL);
}

static int parse_uint(const char *value, unsigned int maximum, unsigned int *result) {
  char *end = NULL;
  errno = 0;
  unsigned long parsed = strtoul(value, &end, 10);
  if (errno != 0 || !end || *end != '\0' || parsed > maximum) return -1;
  *result = (unsigned int)parsed;
  return 0;
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "usage: osk-input MODIFIER_MASK EVDEV_KEYCODE\n");
    return 2;
  }

  unsigned int modifiers = 0;
  unsigned int keycode = 0;
  if (parse_uint(argv[1], 77, &modifiers) != 0 || (modifiers & ~77U) != 0 ||
      parse_uint(argv[2], 255, &keycode) != 0 || keycode == 0) {
    fprintf(stderr, "osk-input: invalid closed key action\n");
    return 2;
  }

  struct wl_display *display = wl_display_connect(NULL);
  if (!display) {
    fprintf(stderr, "osk-input: cannot connect to Wayland\n");
    return 1;
  }

  struct backend backend = {0};
  struct wl_registry *registry = wl_display_get_registry(display);
  wl_registry_add_listener(registry, &registry_listener, &backend);
  wl_display_roundtrip(display);
  if (!backend.seat || !backend.manager) {
    fprintf(stderr, "osk-input: virtual keyboard protocol is unavailable\n");
    wl_registry_destroy(registry);
    wl_display_disconnect(display);
    return 1;
  }

  struct zwp_virtual_keyboard_v1 *keyboard =
    zwp_virtual_keyboard_manager_v1_create_virtual_keyboard(backend.manager, backend.seat);
  if (!keyboard || upload_keymap(keyboard) != 0) {
    fprintf(stderr, "osk-input: cannot create the evdev keymap\n");
    if (keyboard) zwp_virtual_keyboard_v1_destroy(keyboard);
    zwp_virtual_keyboard_manager_v1_destroy(backend.manager);
    wl_seat_destroy(backend.seat);
    wl_registry_destroy(registry);
    wl_display_disconnect(display);
    return 1;
  }

  wl_display_roundtrip(display);
  zwp_virtual_keyboard_v1_modifiers(keyboard, modifiers, 0, 0, 0);
  wl_display_roundtrip(display);
  zwp_virtual_keyboard_v1_key(
    keyboard, event_time(), keycode, WL_KEYBOARD_KEY_STATE_PRESSED);
  wl_display_roundtrip(display);
  usleep(2000);
  zwp_virtual_keyboard_v1_key(
    keyboard, event_time(), keycode, WL_KEYBOARD_KEY_STATE_RELEASED);
  wl_display_roundtrip(display);
  zwp_virtual_keyboard_v1_modifiers(keyboard, 0, 0, 0, 0);
  wl_display_roundtrip(display);

  zwp_virtual_keyboard_v1_destroy(keyboard);
  zwp_virtual_keyboard_manager_v1_destroy(backend.manager);
  wl_seat_destroy(backend.seat);
  wl_registry_destroy(registry);
  wl_display_disconnect(display);
  return 0;
}
