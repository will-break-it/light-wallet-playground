#!/bin/bash

./cardano-js-sdk/packages/cardano-services/dist/cjs/cli.js \
  start-projector \
    --synchronize true --ogmios-url 'ws://localhost:1339' \
    --postgres-connection-string 'postgresql://postgres:doNoUseThisSecret!@localhost/projection' \
    transaction