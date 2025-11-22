use crate::error::AppError;
use crate::handlers::AppState;
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use std::{
    future::{ready, Ready},
    rc::Rc,
};

/// Extension data stored in request extensions containing the authenticated username.
///
/// This is set by the AuthMiddleware after successful token verification.
pub struct AuthenticatedUser(pub String);

/// Middleware factory for JWT authentication.
///
/// This middleware protects routes by requiring a valid JWT token in the
/// Authorization header. The token is verified and the username is stored
/// in request extensions for use by handlers.
pub struct AuthMiddleware;

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service: Rc::new(service),
        }))
    }
}

/// Internal service wrapper that implements the authentication logic.
pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            // Extract AppState
            let app_state = req
                .app_data::<actix_web::web::Data<AppState>>()
                .ok_or_else(|| {
                    AppError::InternalError("AppState not found".to_string())
                })?;

            // Extract Authorization header
            let auth_header = req
                .headers()
                .get("Authorization")
                .ok_or_else(|| {
                    AppError::AuthError("Missing Authorization header".to_string())
                })?
                .to_str()
                .map_err(|_| {
                    AppError::AuthError("Invalid Authorization header".to_string())
                })?;

            if !auth_header.starts_with("Bearer ") {
                return Err(actix_web::error::ErrorUnauthorized(
                    AppError::AuthError("Invalid Authorization format".to_string()),
                ));
            }

            let token = &auth_header[7..];
            let claims = app_state
                .auth_service
                .verify_token(token)
                .map_err(|e| actix_web::error::ErrorUnauthorized(e))?;

            // Store authenticated username in request extensions
            req.extensions_mut().insert(AuthenticatedUser(claims.sub));

            // Continue with the request
            let res = service.call(req).await?;
            Ok(res)
        })
    }
}

