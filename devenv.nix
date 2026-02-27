{pkgs, ...}: {
  packages = [
    # A python dependency outside of poetry.
  ];

  enterShell = ''
    # Set npm prefix to a writable location for global installs
    export NPM_CONFIG_PREFIX="$HOME/.npm-global"
    export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

    # Install pi-coding-agent if not already installed
    if ! command -v pi &> /dev/null; then
      echo "Installing pi-coding-agent..."
      mkdir -p "$NPM_CONFIG_PREFIX"
      npm install -g @mariozechner/pi-coding-agent
    fi
  '';

  languages.python = {
    enable = true;
    version = "3.12";
    poetry = {
      enable = true;
      install = {
        enable = true;
        verbosity = "debug";
      };
      activate.enable = true;
      package = pkgs.poetry;
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
