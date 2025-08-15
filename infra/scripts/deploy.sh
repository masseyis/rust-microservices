#!/usr/bin/env bash
set -euo pipefail
pushd infra/cdk >/dev/null
npm ci >/dev/null
npm run build
npx cdk deploy --all --require-approval never
popd >/dev/null
