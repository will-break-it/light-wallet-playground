#!/bin/bash

set -e

# Define the base paths
CJSSDK_PACKAGE_PATH="$(pwd)/cardano-js-sdk/packages"
NODE_MODULES_PATH="$(pwd)/node_modules/@cardano-sdk"

# Package names to be linked locally
PACKAGES=("core" "cardano-services" "ogmios" "projection" "projection-typeorm" "util-rxjs")

create_symlink() {
    local package=$1
    echo "Creating symlink for $package..."
    rm -rf "$NODE_MODULES_PATH/$package"
    ln -sf "$CJSSDK_PACKAGE_PATH/$package" "$NODE_MODULES_PATH/$package"
}

# Main script execution
echo "Starting to create symlinks..."

for package in "${PACKAGES[@]}"; do
    create_symlink "$package"
done

echo "Symlink creation completed."