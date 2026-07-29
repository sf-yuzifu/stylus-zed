use zed_extension_api as zed;

struct StylusExtension;

impl zed::Extension for StylusExtension {
    fn new() -> Self {
        Self
    }
}

zed::register_extension!(StylusExtension);
