use lambda_runtime::{service_fn, Error, LambdaEvent};
use common::Event;
use aws_sdk_dynamodb as dynamodb;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).init();
    let conf = aws_config::load_from_env().await;
    let db = dynamodb::Client::new(&conf);

    lambda_runtime::run(service_fn(move |evt: LambdaEvent<serde_json::Value>| {
        let db = db.clone();
        async move {
            let detail = evt.payload.get("detail").cloned().unwrap_or(serde_json::Value::Null);
            let items = match detail {
                serde_json::Value::Array(arr) => arr,
                v => vec![v],
            };

            for r in items {
                if r.is_null() { continue; }
                let e: Event = serde_json::from_value(r).unwrap_or_else(|_| Event::UserRegistered { user_id: "unknown".into(), email: "".into() });
                match e {
                    Event::OrderPlaced { order_id, user_id, total_cents } => {
                        db.put_item()
                            .table_name(std::env::var("ORDERS_TABLE").unwrap())
                            .item("pk", dynamodb::types::AttributeValue::S(format!("ORDER#{order_id}")))
                            .item("sk", dynamodb::types::AttributeValue::S("v0".into()))
                            .item("user_id", dynamodb::types::AttributeValue::S(user_id))
                            .item("total_cents", dynamodb::types::AttributeValue::N(total_cents.to_string()))
                            .send().await?;
                    }
                    _ => {}
                }
            }
            Ok::<_, Error>(())
        }
    })).await
}
