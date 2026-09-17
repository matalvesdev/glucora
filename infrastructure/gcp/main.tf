locals {
  resources_enabled = var.enable_resources
  name_prefix       = "glucora-${var.environment}"
  labels = {
    application = "glucora"
    environment = var.environment
    managed_by  = "terraform"
  }
}

check "enabled_resource_inputs" {
  assert {
    condition = !local.resources_enabled || (
      var.project_id != null && var.environment != null && var.api_image != null &&
      var.database_tier != null && var.database_availability_type != null &&
      var.transaction_log_retention_days != null
    )
    error_message = "Required runtime, database capacity and recovery inputs are missing."
  }
}

check "deletion_job_inputs" {
  assert {
    condition     = !var.enable_deletion_job || (local.resources_enabled && var.deletion_job_image != null)
    error_message = "A deletion job requires the resource switch and an approved immutable worker image."
  }
}

check "deletion_schedule_inputs" {
  assert {
    condition = !var.enable_deletion_schedule || (
      local.resources_enabled && var.enable_deletion_job &&
      var.deletion_schedule != null && var.deletion_scheduler_uri != null &&
      var.deletion_scheduler_audience != null
    )
    error_message = "A deletion schedule requires an enabled reviewed worker, cron, target URI and OIDC audience."
  }
}

resource "google_service_account" "api" {
  count        = local.resources_enabled ? 1 : 0
  account_id   = "${local.name_prefix}-api"
  display_name = "Glucora API runtime"
}

resource "google_service_account" "scheduler" {
  count        = local.resources_enabled ? 1 : 0
  account_id   = "${local.name_prefix}-scheduler"
  display_name = "Glucora internal scheduler"
}

resource "google_service_account" "deletion_job" {
  count        = local.resources_enabled ? 1 : 0
  account_id   = "${local.name_prefix}-deletion"
  display_name = "Glucora deletion job"
}

resource "google_secret_manager_secret" "database_url" {
  count     = local.resources_enabled ? 1 : 0
  secret_id = "${local.name_prefix}-database-url"
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_sql_database_instance" "canonical" {
  count               = local.resources_enabled ? 1 : 0
  name                = "${local.name_prefix}-canonical"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = true

  settings {
    tier              = var.database_tier
    availability_type = var.database_availability_type
    disk_autoresize   = true
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.transaction_log_retention_days
    }
    ip_configuration {
      ipv4_enabled = false
    }
    user_labels = local.labels
  }
}

resource "google_storage_bucket" "exports" {
  count                       = local.resources_enabled ? 1 : 0
  name                        = "${local.name_prefix}-exports-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = local.labels

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 30 }
  }
}

resource "google_storage_bucket" "backups" {
  count                       = local.resources_enabled ? 1 : 0
  name                        = "${local.name_prefix}-backups-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = local.labels

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 90 }
  }
}

resource "google_cloud_run_v2_service" "api" {
  count    = local.resources_enabled ? 1 : 0
  name     = "${local.name_prefix}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.api[0].email
    containers {
      image = var.api_image
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url[0].secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_job" "deletion" {
  count    = local.resources_enabled && var.enable_deletion_job ? 1 : 0
  name     = "${local.name_prefix}-deletion"
  location = var.region

  template {
    template {
      service_account = google_service_account.deletion_job[0].email
      containers { image = var.deletion_job_image }
    }
  }
}

resource "google_cloud_scheduler_job" "deletion" {
  count       = local.resources_enabled && var.enable_deletion_schedule ? 1 : 0
  name        = "${local.name_prefix}-deletion"
  region      = var.region
  schedule    = var.deletion_schedule
  time_zone   = "America/Sao_Paulo"
  description = "Internal trigger only; domain checks determine whether work may run."

  http_target {
    http_method = "POST"
    uri         = var.deletion_scheduler_uri
    oidc_token {
      service_account_email = google_service_account.scheduler[0].email
      audience              = var.deletion_scheduler_audience
    }
  }
}
