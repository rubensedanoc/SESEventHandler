# SES SNS Receiver

Servicio Node.js para recibir notificaciones HTTP de Amazon SNS asociadas a Amazon SES y guardar eventos en MongoDB.

## Eventos soportados

- `SubscriptionConfirmation`
- `Delivery`
- `Bounce`
- `Complaint`
- `Reject`

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Ajusta los valores si lo necesitas.

```env
PORT=3000
MONGODB_URI=mongodb://USER:PASSWORD@HOST1,HOST2,HOST3,HOST4/?replicaSet=rs0&authSource=admin
SNS_TOPIC_ARN=
```

`SNS_TOPIC_ARN` es opcional, pero si lo configuras el servicio rechazará mensajes de otros topics.

## Arranque

```bash
npm install
npm run dev
```

Producción:

```bash
npm start
```

## Docker

Construir imagen:

```bash
docker build -t ses-sns-events:latest .
```

Ejecutar contenedor:

```bash
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e MONGODB_URI="mongodb://USER:PASSWORD@HOST1,HOST2,HOST3,HOST4/?replicaSet=rs0&authSource=admin" \
  -e SNS_TOPIC_ARN="" \
  ses-sns-events:latest
```

## GitHub Actions y AWS ECR

Te dejé el workflow en [.github/workflows/docker-ecr-release.yml](/Users/rubensedano/Documents/Codex/SESEvents/.github/workflows/docker-ecr-release.yml).

Qué necesitas configurar en GitHub:

- Secret `AWS_ACCESS_KEY_ID`
- Secret `AWS_SECRET_ACCESS_KEY`
- Variable `AWS_REGION`
- Variable `ECR_REPOSITORY`

Flujo recomendado de versionado:

1. Actualiza la versión en `package.json`.
2. Haz commit del cambio.
3. Crea un tag con el mismo valor, por ejemplo `v1.0.1`.
4. Haz push del tag a GitHub.

Ejemplo:

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

El workflow:

- valida que el tag y `package.json` tengan la misma versión
- construye la imagen Docker para `linux/amd64`
- publica la imagen con `--provenance=false`
- publica en AWS ECR con tags `1.0.1` y `latest`

También puedes lanzarlo manualmente desde GitHub Actions con `workflow_dispatch`, indicando una versión semántica.

## GitHub Actions para deploy en Kubernetes on-prem

Te dejé también el workflow en [.github/workflows/deploy-k8s.yml](/Users/rubensedano/Documents/Codex/SESEvents/.github/workflows/deploy-k8s.yml).

Qué necesitas configurar en GitHub:

- Secret `KUBE_CONFIG_B64` con tu kubeconfig en base64
- Variable `ECR_REGISTRY`
- Variable `ECR_REPOSITORY`
- Variable opcional `K8S_NAMESPACE` si quieres sobrescribir `prd`
- Variable opcional `K8S_DEPLOYMENT_NAME` si quieres sobrescribir `ses-sns-events`
- Variable opcional `K8S_CONTAINER_NAME` si quieres sobrescribir `ses-sns-events`

Cómo funciona:

- corre en tu `self-hosted runner`
- carga el kubeconfig cifrado desde GitHub Secrets en formato base64
- actualiza la imagen del deployment con la versión que indiques
- espera el `rollout` para confirmar que Kubernetes levantó bien

Requisito importante:

- El workflow de deploy no podrá ejecutarse correctamente si no existe el secret `KUBE_CONFIG_B64` en GitHub Secrets.
- Ese secret es obligatorio porque desde allí se carga el acceso al clúster Kubernetes.

Ejemplo de imagen que desplegará:

```text
<ECR_REGISTRY>/<ECR_REPOSITORY>:1.0.1
```

Importante:

- Tu clúster on-prem debe poder hacer `pull` desde AWS ECR.
- Si Kubernetes necesita autenticación para ECR, tendrás que configurar un `imagePullSecret` en el namespace `prd`.

## Kubernetes

- Usa variables de entorno para `MONGODB_URI`, `PORT` y opcionalmente `SNS_TOPIC_ARN`.
- Los manifiestos están preparados para el namespace `prd`.
- Configura `containerPort: 3000`.
- Puedes usar `GET /health` como `readinessProbe` y `livenessProbe`.
- El proceso maneja `SIGTERM`, así que el pod puede apagarse de forma ordenada durante despliegues.
- Te dejé ejemplos base en [k8s/namespace.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/namespace.yaml), [k8s/configmap.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/configmap.yaml), [k8s/secret.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/secret.example.yaml), [k8s/deployment.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/deployment.yaml) y [k8s/service.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/service.yaml).
- El orden sugerido de arranque inicial quedó documentado en [k8s/00-PASOS.md](/Users/rubensedano/Documents/Codex/SESEvents/k8s/00-PASOS.md).
- El repo debe guardar solo la plantilla [k8s/secret.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/secret.example.yaml), nunca un secret real con credenciales.
- El deployment ya está preparado para usar `imagePullSecrets` con el secret `ecr-pull-secret`.

Aplicación básica:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.example.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

Para producción, crea el secret real fuera del repo. Ejemplo:

```bash
kubectl -n prd create secret generic ses-sns-events-secrets \
  --from-literal=MONGODB_URI="mongodb://USER:PASSWORD@HOST1,HOST2,HOST3,HOST4/?replicaSet=rs0&authSource=admin"
```

O si prefieres archivo, crea un `k8s/secret.yaml` local no versionado basado en `k8s/secret.example.yaml`.

## Acceso de Kubernetes a AWS ECR

Tu clúster on-prem necesita un `imagePullSecret` para poder descargar la imagen desde ECR.

### Opción 1: crear el secret manualmente

Te dejé un ejemplo en [k8s/ecr-pull-secret.example.sh](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-pull-secret.example.sh).

Ejemplo:

```bash
AWS_REGION=us-east-1 \
ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com \
NAMESPACE=prd \
bash k8s/ecr-pull-secret.example.sh
```

Esto crea o actualiza el secret `ecr-pull-secret` en `prd`.

### Opción 2: renovación automática con CronJob

Como el token de ECR expira, te dejé manifiestos para renovarlo automáticamente:

- [k8s/ecr-refresh-secret.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-refresh-secret.example.yaml)
- [k8s/ecr-refresh-rbac.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-refresh-rbac.yaml)
- [k8s/ecr-refresh-cronjob.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-refresh-cronjob.yaml)

Qué hacer:

1. Crea un archivo local `k8s/ecr-refresh-secret.yaml` basado en `k8s/ecr-refresh-secret.example.yaml`.
2. Pon allí tus credenciales AWS técnicas y el registry ECR real.
3. Aplícalo junto con RBAC y CronJob.

```bash
kubectl apply -f k8s/ecr-refresh-secret.yaml
kubectl apply -f k8s/ecr-refresh-rbac.yaml
kubectl apply -f k8s/ecr-refresh-cronjob.yaml
```

`k8s/ecr-refresh-secret.yaml` está ignorado por git y no debe subirse al repo.

## Endpoint

- `POST /webhooks/sns`
- `GET /health`

## Configuración en AWS

1. Crea una suscripción HTTP o HTTPS en tu topic SNS.
2. Usa como endpoint `https://tu-dominio.com/webhooks/sns`.
3. SNS enviará un `SubscriptionConfirmation` y el servicio lo confirmará automáticamente.
4. Configura en SES el envío de eventos al topic SNS correspondiente.

## Estructura guardada

Cada documento conserva:

- metadatos SNS (`MessageId`, `TopicArn`, `Type`)
- `notificationType` de SES
- `mail.messageId`
- fecha del evento
- detalle específico del evento (`delivery`, `bounce`, `complaint`, `reject`)
- payload original de SNS y SES

## Notas

- El proyecto valida opcionalmente el `TopicArn`, pero no verifica la firma criptográfica de SNS.
- Si quieres, en el siguiente paso puedo agregarte firma SNS, Docker, PM2 o endpoints para consultar estadísticas.
