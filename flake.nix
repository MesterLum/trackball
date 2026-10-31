{
  description = "Trackball configurator: Node.js 24 LTS and shared development/CI commands";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 pkgs.just pkgs.git pkgs.lefthook ];
            shellHook = ''
              export COREPACK_HOME="$PWD/.cache/corepack"
              mkdir -p "$COREPACK_HOME/bin"
              printf '%s\n' '{"type":"commonjs"}' > "$COREPACK_HOME/package.json"
              corepack enable --install-directory "$COREPACK_HOME/bin" yarn
              export PATH="$COREPACK_HOME/bin:$PATH"
              echo "Trackball: Node $(node --version). Run just to list project commands."
            '';
          };
        });
    };
}
