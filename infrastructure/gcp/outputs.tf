output "api_service_uri" {
  description = "Private Cloud Run service URI after an explicitly enabled apply."
  value       = try(google_cloud_run_v2_service.api[0].uri, null)
}

output "database_secret_id" {
  description = "Secret identifier only; Terraform never stores a secret value."
  value       = try(google_secret_manager_secret.database_url[0].secret_id, null)
}
