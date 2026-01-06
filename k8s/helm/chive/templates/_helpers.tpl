{{/*
Expand the name of the chart.
*/}}
{{- define "chive.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "chive.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "chive.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chive.labels" -}}
helm.sh/chart: {{ include "chive.chart" . }}
{{ include "chive.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: chive
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chive.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chive.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
AppView labels
*/}}
{{- define "chive.appview.labels" -}}
{{ include "chive.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
AppView selector labels
*/}}
{{- define "chive.appview.selectorLabels" -}}
{{ include "chive.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Indexer labels
*/}}
{{- define "chive.indexer.labels" -}}
{{ include "chive.labels" . }}
app.kubernetes.io/component: indexer
{{- end }}

{{/*
Indexer selector labels
*/}}
{{- define "chive.indexer.selectorLabels" -}}
{{ include "chive.selectorLabels" . }}
app.kubernetes.io/component: indexer
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "chive.frontend.labels" -}}
{{ include "chive.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "chive.frontend.selectorLabels" -}}
{{ include "chive.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account
*/}}
{{- define "chive.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chive.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get the secrets name
*/}}
{{- define "chive.secretsName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "chive.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Image name with registry
*/}}
{{- define "chive.image" -}}
{{- if .Values.global.imageRegistry }}
{{- printf "%s/%s:%s" .Values.global.imageRegistry .repository .tag }}
{{- else }}
{{- printf "%s:%s" .repository .tag }}
{{- end }}
{{- end }}
