#!/bin/bash

OSK_REPOSITORY_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
OSK_SOURCE_THEME="$OSK_REPOSITORY_ROOT/system/sddm/omarchy-onscreen-keyboard"
OSK_SOURCE_DROPIN="$OSK_REPOSITORY_ROOT/system/sddm/99-z-omarchy-onscreen-keyboard.conf"
OSK_THEME_FILES=(Main.qml Keyboard.qml metadata.desktop theme.conf)

osk_fail() {
  printf 'omarchy-onscreen-keyboard: %s\n' "$*" >&2
  return 1
}

osk_system_root() {
  local root=${OMARCHY_OSK_SYSTEM_ROOT:-}
  if [[ -z $root ]]; then
    printf '/\n'
    return 0
  fi
  [[ $root == /* ]] || osk_fail "OMARCHY_OSK_SYSTEM_ROOT must be an absolute path"
  root=${root%/}
  [[ -n $root ]] || root=/
  printf '%s\n' "$root"
}

osk_target() {
  local root=$1
  local path=$2
  if [[ $root == "/" ]]; then
    printf '%s\n' "$path"
  else
    printf '%s%s\n' "$root" "$path"
  fi
}

osk_require_privilege() {
  local root=$1
  if [[ $root == "/" ]] && (( EUID != 0 )); then
    osk_fail "system integration requires root; rerun this command with sudo"
  fi
}

osk_source_version() {
  jq -er '.version' "$OSK_REPOSITORY_ROOT/manifest.json"
}

osk_hash() {
  sha256sum "$1" | awk '{print $1}'
}

osk_manifest_value() {
  local manifest=$1
  local key=$2
  awk -F= -v wanted="$key" '$1 == wanted { print substr($0, index($0, "=") + 1); exit }' "$manifest"
}

osk_paths() {
  local root=$1
  OSK_THEME_DIR=$(osk_target "$root" /usr/share/sddm/themes/omarchy-onscreen-keyboard)
  OSK_DROPIN=$(osk_target "$root" /etc/sddm.conf.d/99-z-omarchy-onscreen-keyboard.conf)
  OSK_INSTALLED_MANIFEST="$OSK_THEME_DIR/.integration-manifest"
}

osk_validate_targets() {
  [[ ! -L $OSK_THEME_DIR ]] || osk_fail "refusing a symlinked SDDM theme destination: $OSK_THEME_DIR"
  [[ ! -L $OSK_DROPIN ]] || osk_fail "refusing a symlinked SDDM configuration destination: $OSK_DROPIN"
}

osk_validate_sources() {
  [[ -d $OSK_SOURCE_THEME ]] || osk_fail "missing SDDM theme source"
  [[ -f $OSK_SOURCE_DROPIN && ! -L $OSK_SOURCE_DROPIN ]] || osk_fail "missing or unsafe SDDM drop-in source"
  local link
  link=$(find "$OSK_SOURCE_THEME" -type l -print -quit)
  [[ -z $link ]] || osk_fail "SDDM theme source may not contain symlinks: $link"
  local file
  for file in "${OSK_THEME_FILES[@]}"; do
    [[ -f $OSK_SOURCE_THEME/$file ]] || osk_fail "missing SDDM theme file: $file"
  done
}

osk_inspect() {
  local root=$1
  osk_paths "$root"
  osk_validate_targets
  OSK_STATE=not-installed
  OSK_INSTALLED_VERSION=
  OSK_SOURCE_VERSION=$(osk_source_version)

  if [[ ! -e $OSK_THEME_DIR && ! -e $OSK_DROPIN ]]; then
    return 0
  fi
  if [[ ! -f $OSK_INSTALLED_MANIFEST || ! -f $OSK_DROPIN ]]; then
    OSK_STATE=modified
    return 0
  fi

  local schema
  schema=$(osk_manifest_value "$OSK_INSTALLED_MANIFEST" schema)
  OSK_INSTALLED_VERSION=$(osk_manifest_value "$OSK_INSTALLED_MANIFEST" version)
  if [[ $schema != "1" || -z $OSK_INSTALLED_VERSION ]]; then
    OSK_STATE=modified
    return 0
  fi

  local file recorded actual
  for file in "${OSK_THEME_FILES[@]}"; do
    [[ -f $OSK_THEME_DIR/$file ]] || {
      OSK_STATE=modified
      return 0
    }
    recorded=$(osk_manifest_value "$OSK_INSTALLED_MANIFEST" "file.$file")
    actual=$(osk_hash "$OSK_THEME_DIR/$file")
    if [[ -z $recorded || $actual != "$recorded" ]]; then
      OSK_STATE=modified
      return 0
    fi
  done

  recorded=$(osk_manifest_value "$OSK_INSTALLED_MANIFEST" dropin)
  actual=$(osk_hash "$OSK_DROPIN")
  if [[ -z $recorded || $actual != "$recorded" ]]; then
    OSK_STATE=modified
    return 0
  fi

  if [[ $OSK_INSTALLED_VERSION != "$OSK_SOURCE_VERSION" ]]; then
    OSK_STATE=outdated
    return 0
  fi
  for file in "${OSK_THEME_FILES[@]}"; do
    if [[ $(osk_hash "$OSK_SOURCE_THEME/$file") != "$(osk_hash "$OSK_THEME_DIR/$file")" ]]; then
      OSK_STATE=outdated
      return 0
    fi
  done
  if [[ $(osk_hash "$OSK_SOURCE_DROPIN") != "$(osk_hash "$OSK_DROPIN")" ]]; then
    OSK_STATE=outdated
    return 0
  fi
  # Assigned for the status/install/uninstall callers that source this library.
  # shellcheck disable=SC2034
  OSK_STATE=current
}
