#!/usr/bin/env bash
# Восстанавливает vendor/lct-testkit-rt-ui-*.tgz (приватный пакет дизайн-системы,
# в git не лежит — см. шапку Dockerfile) из релиза `vendor-assets` этого репо.
#
# ПЕРЕХОДНЫЙ механизм: после публикации @lct-testkit/rt-ui в GitHub Packages
# (rt-ui/.github/workflows/release.yml) зависимость переключается на реестр,
# и этот скрипт удаляется вместе с релизом vendor-assets.
#
# Требует: GH_TOKEN, GITHUB_REPOSITORY (заданы в Actions).
set -euo pipefail

mkdir -p vendor
if ! gh release download vendor-assets \
    --repo "${GITHUB_REPOSITORY}" \
    --pattern "lct-testkit-rt-ui-*.tgz" \
    --dir vendor --clobber; then
  {
    echo "::error::Нет релиза 'vendor-assets' с приватным пакетом rt-ui (или у GITHUB_TOKEN нет доступа)."
    echo "::error::Разовая настройка — из корня frontend, с vendor/lct-testkit-rt-ui-*.tgz на месте:"
    echo "::error::  gh release create vendor-assets --repo ${GITHUB_REPOSITORY} \\"
    echo "::error::    --title 'Vendor assets (private, build-time only)' \\"
    echo "::error::    --notes 'Приватный пакет заказчика, не публиковать содержимое' \\"
    echo "::error::    vendor/lct-testkit-rt-ui-*.tgz"
  } >&2
  exit 1
fi

# Версия tarball должна совпадать с той, на которую указывает package.json.
expected="$(node -p "require('./package.json').dependencies['@lct-testkit/rt-ui'].split('/').pop()")"
if [ ! -f "vendor/${expected}" ]; then
  echo "::error::package.json ждёт vendor/${expected}, а в релизе vendor-assets лежит: $(ls vendor | tr '\n' ' ')" >&2
  exit 1
fi
ls -la vendor/
