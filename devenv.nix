{ pkgs, ... }: {
  dotenv.enable = true;
  enterShell = ''
    export NPM_CONFIG_PREFIX="$HOME/.npm-global"
    export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  '';
  languages.python = {
    enable = true;
    version = "3.12";
  };
  languages.javascript = {
    enable = true;
    npm = {
      enable = true;
    };
  };
}
