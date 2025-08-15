use lambda_http::{run, service_fn, Body, Request, Response};
use lambda_runtime::Error;
use common::{Event, flags::FlagClient};
use aws_sdk_eventbridge as eventbridge;
use tracing_subscriber::EnvFilter;
use http::Method;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).init();

    let conf = aws_config::load_from_env().await;
    let eb = eventbridge::Client::new(&conf);
    let flags = FlagClient::new(
        std::env::var("APPCONFIG_APP")?,
        std::env::var("APPCONFIG_ENV")?,
        std::env::var("APPCONFIG_PROFILE")?,
        30,
    ).await.unwrap();

    run(service_fn(move |req: Request| {
        let eb = eb.clone();
        let flags = flags.clone();
        async move {
            let path = req.uri().path();
            match (req.method(), path) {
                (_, "/health") => Ok::<_, Error>(resp(200, "ok")),
                (&Method::POST, "/orders") => {
                    let body = req.into_body();
                    let bytes = match body { Body::Text(s) => s.into_bytes(), Body::Binary(b) => b, _ => Vec::new() };
                    let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap_or_default();
                    let order_id = v.get("order_id").and_then(|x| x.as_str()).unwrap_or("unknown").to_string();
                    let user_id = v.get("user_id").and_then(|x| x.as_str()).unwrap_or("unknown").to_string();

                    let f = flags.get().await.unwrap_or_default();
                    if f.new_checkout {
                        // put any new flow logic here
                    }

                    let evt = Event::OrderPlaced { order_id: order_id.clone(), user_id, total_cents: 12345 };
                    let _ = eb.put_events().entries(
                        eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
                            .event_bus_name(std::env::var("EVENT_BUS").unwrap())
                            .source("api")
                            .detail_type("Event")
                            .detail(serde_json::to_string(&evt).unwrap())
                            .build()
                    ).send().await;

                    Ok(resp(202, &format!("accepted {order_id}")))
                }
                _ => Ok(resp(404, "not found")),
            }
        }
    })).await
}

fn resp(code: i32, body: &str) -> Response<Body> { Response::builder().status(code).body(Body::Text(body.into())).unwrap() }
