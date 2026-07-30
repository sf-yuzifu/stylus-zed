use std::{env, fs};

use zed_extension_api::{self as zed, Result};

const PACKAGE_NAME: &str = "stylus-language-server";
const PACKAGE_VERSION: &str = "0.5.0";
const SERVER_PATH: &str = "node_modules/stylus-language-server/bin/stylus-language-server.js";

struct StylusExtension {
    did_find_server: bool,
}

impl StylusExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).is_ok_and(|metadata| metadata.is_file())
    }

    fn server_script_path(&mut self, id: &zed::LanguageServerId) -> Result<String> {
        if self.did_find_server && self.server_exists() {
            return Ok(SERVER_PATH.to_string());
        }

        let installed_version = zed::npm_package_installed_version(PACKAGE_NAME)?;
        if self.server_exists() && installed_version.as_deref() == Some(PACKAGE_VERSION) {
            self.did_find_server = true;
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );
        zed::set_language_server_installation_status(
            id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        if let Err(error) = zed::npm_install_package(PACKAGE_NAME, PACKAGE_VERSION) {
            if !self.server_exists() {
                return Err(error);
            }
        }

        if !self.server_exists() {
            return Err(format!(
                "installed package '{PACKAGE_NAME}' did not contain '{SERVER_PATH}'"
            ));
        }

        self.did_find_server = true;
        Ok(SERVER_PATH.to_string())
    }
}

impl zed::Extension for StylusExtension {
    fn new() -> Self {
        Self {
            did_find_server: false,
        }
    }

    fn language_server_command(
        &mut self,
        id: &zed::LanguageServerId,
        _: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = self.server_script_path(id)?;
        let server_path = env::current_dir()
            .map_err(|error| format!("failed to resolve extension directory: {error}"))?
            .join(server_path)
            .to_string_lossy()
            .into_owned();

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path, "--stdio".to_string()],
            env: Vec::new(),
        })
    }
}

zed::register_extension!(StylusExtension);
