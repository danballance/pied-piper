{pkgs, ...}: {
  # Load .env automatically (API keys).
  dotenv.enable = true;

  # Consolidate Python bytecode into a single directory.
  env.PYTHONPYCACHEPREFIX = ".pycache";

  packages = [
    pkgs.just
  ];

  enterShell = ''
    # Set npm prefix to a writable location for global installs.
    export NPM_CONFIG_PREFIX="$HOME/.npm-global"
    export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

    # Install pi-coding-agent if not already installed.
    if ! command -v pi &> /dev/null; then
      echo "Installing pi-coding-agent..."
      mkdir -p "$NPM_CONFIG_PREFIX"
      npm install -g @mariozechner/pi-coding-agent
    fi
  '';

  languages.python = {
    enable = true;
    version = "3.12";
    venv.enable = true;
    uv = {
      enable = true;
      sync = {
        enable = true;
        allExtras = true;
      };
    };
  };

  languages.javascript = {
    enable = true;
    npm = {
      enable = true;
      install.enable = true;
    };
  };
}
