use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    OrderPlaced { order_id: String, user_id: String, total_cents: i64 },
    UserRegistered { user_id: String, email: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Flags {
    pub new_checkout: bool,
    pub beta_banner: bool,
}

pub mod flags {
    use super::Flags;
    use aws_sdk_appconfigdata as appconfigdata;
    use std::time::{Duration, Instant};
    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum FlagError {
        #[error("AppConfig error: {0}")] AppConfig(String),
        #[error("Invalid payload")] Invalid,
    }

    #[derive(Clone)]
    pub struct FlagClient {
        client: appconfigdata::Client,
        application_id: String,
        environment_id: String,
        profile_id: String,
        cache: tokio::sync::RwLock<(Flags, Instant)>,
        ttl: Duration,
    }

    impl FlagClient {
        pub async fn new(application_id: String, environment_id: String, profile_id: String, ttl_secs: u64) -> Result<Self, FlagError> {
            let conf = aws_config::load_from_env().await;
            let client = appconfigdata::Client::new(&conf);
            Ok(Self {
                client,
                application_id,
                environment_id,
                profile_id,
                cache: tokio::sync::RwLock::new((Flags::default(), Instant::now() - Duration::from_secs(3600))),
                ttl: Duration::from_secs(ttl_secs),
            })
        }

        pub async fn get(&self) -> Result<Flags, FlagError> {
            let (cached, at) = { self.cache.read().await.clone() };
            if at.elapsed() < self.ttl { return Ok(cached); }

            let s = self.client
                .start_configuration_session()
                .application_identifier(&self.application_id)
                .environment_identifier(&self.environment_id)
                .configuration_profile_identifier(&self.profile_id)
                .send().await.map_err(|e| FlagError::AppConfig(e.to_string()))?;

            let token = s.initial_configuration_token().unwrap_or_default().to_string();
            let g = self.client
                .get_latest_configuration()
                .configuration_token(token)
                .send().await.map_err(|e| FlagError::AppConfig(e.to_string()))?;

            let bytes = g.configuration().unwrap_or_default().as_ref().to_vec();
            let flags: Flags = if bytes.is_empty() { Flags::default() } else { serde_yaml::from_slice(&bytes).map_err(|_| FlagError::Invalid)? };

            {
                let mut w = self.cache.write().await;
                *w = (flags.clone(), Instant::now());
            }
            Ok(flags)
        }
    }
}
