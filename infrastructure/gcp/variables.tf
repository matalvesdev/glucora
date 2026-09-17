variable "enable_resources" {
  description = "Explicit safety switch. Resources are never created while false."
  type        = bool
  default     = false
}

variable "project_id" {
  description = "Google Cloud project identifier. Keep this outside version control."
  type        = string
  default     = null
  nullable    = true
}

variable "environment" {
  description = "Deployment environment name, for example staging or production."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.environment == null || can(regex("^[a-z][a-z0-9-]{1,30}$", var.environment))
    error_message = "environment must be a lowercase DNS-label-like value."
  }
}

variable "region" {
  description = "ADR-050 production region."
  type        = string
  default     = "southamerica-east1"

  validation {
    condition     = var.region == "southamerica-east1"
    error_message = "ADR-050 currently permits only southamerica-east1."
  }
}

variable "api_image" {
  description = "Immutable container image reference for Cloud Run."
  type        = string
  default     = null
  nullable    = true
}

variable "database_tier" {
  description = "Cloud SQL machine tier selected during capacity review."
  type        = string
  default     = null
  nullable    = true
}

variable "database_availability_type" {
  description = "Cloud SQL availability type selected during operational review."
  type        = string
  default     = null
  nullable    = true
}

variable "transaction_log_retention_days" {
  description = "Cloud SQL point-in-time recovery retention selected during the backup review."
  type        = number
  default     = null
  nullable    = true

  validation {
    condition = var.transaction_log_retention_days == null || (
      var.transaction_log_retention_days >= 1 && var.transaction_log_retention_days <= 7
    )
    error_message = "Cloud SQL transaction log retention must be between 1 and 7 days."
  }
}

variable "enable_deletion_job" {
  description = "Separate gate for the deletion worker; it remains disabled until its adapter is approved."
  type        = bool
  default     = false
}

variable "deletion_job_image" {
  description = "Immutable image for the separately reviewed deletion worker."
  type        = string
  default     = null
  nullable    = true
}

variable "enable_deletion_schedule" {
  description = "Separate operational gate for a Scheduler trigger."
  type        = bool
  default     = false
}

variable "deletion_schedule" {
  description = "Approved cron expression for the deletion trigger."
  type        = string
  default     = null
  nullable    = true
}

variable "deletion_scheduler_uri" {
  description = "Private reviewed target URI for the deletion trigger."
  type        = string
  default     = null
  nullable    = true
}

variable "deletion_scheduler_audience" {
  description = "OIDC audience for the private deletion trigger."
  type        = string
  default     = null
  nullable    = true
}
