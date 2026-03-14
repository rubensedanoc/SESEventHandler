# Pasos para levantar en Kubernetes on-prem

## 1. Crea el namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

## 2. Ajusta la imagen del deployment

Edita [deployment.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/deployment.yaml) y reemplaza:

```yaml
image: REPLACE_WITH_ECR_REGISTRY/REPLACE_WITH_ECR_REPOSITORY:latest
```

Por tu imagen real de ECR, por ejemplo:

```yaml
image: 841435092050.dkr.ecr.us-east-1.amazonaws.com/prd/ms-sesevents:latest
```

## 3. Crea tu configmap local

1. Copia [configmap.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/configmap.example.yaml) a `k8s/configmap.yaml`
2. Ajusta:

- `PORT`
- `SNS_TOPIC_ARN`

## 4. Crea el secret de la aplicacion

Tienes dos opciones:

Opcion A, por comando:

```bash
kubectl -n prd create secret generic ses-sns-events-secrets \
  --from-literal=MONGODB_URI="mongodb://USER:PASSWORD@HOST1,HOST2,HOST3,HOST4/?replicaSet=rs0&authSource=admin"
```

Opcion B, por archivo local:

1. Copia [secret.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/secret.example.yaml) a `k8s/secret.yaml`
2. Cambia `MONGODB_URI`
3. Ejecuta:

```bash
kubectl apply -f k8s/secret.yaml
```

## 5. Crea el imagePullSecret por primera vez

Usa el script [ecr-pull-secret.example.sh](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-pull-secret.example.sh):

```bash
AWS_REGION=us-east-1 \
ECR_REGISTRY=841435092050.dkr.ecr.us-east-1.amazonaws.com \
NAMESPACE=prd \
bash k8s/ecr-pull-secret.example.sh
```

Esto crea el secret `ecr-pull-secret`, que ya está referenciado por [deployment.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/deployment.yaml).

## 6. Aplica la configuracion base

```bash
cp k8s/configmap.example.yaml k8s/configmap.yaml
kubectl apply -f k8s/configmap.yaml
```

## 7. Despliega la aplicacion

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 8. Verifica que levantó bien

```bash
kubectl -n prd get pods
kubectl -n prd get svc
kubectl -n prd rollout status deployment/ses-sns-events
```

## 9. Activa la renovacion automatica del token de ECR

1. Copia [ecr-refresh-secret.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-refresh-secret.example.yaml) a `k8s/ecr-refresh-secret.yaml`
2. Completa:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REGISTRY`

3. Aplica:

```bash
kubectl apply -f k8s/ecr-refresh-secret.yaml
kubectl apply -f k8s/ecr-refresh-rbac.yaml
kubectl apply -f k8s/ecr-refresh-cronjob.yaml
```

## 10. Verifica el cron de refresco

```bash
kubectl -n prd get cronjob
kubectl -n prd get jobs
```

## 11. Cuando ya funcione el deploy manual

Recién allí conviene activar el workflow de GitHub Actions para despliegue automático, porque ya tendrás:

- la imagen en ECR
- el `imagePullSecret` funcionando
- el `CronJob` renovando credenciales
- el deployment levantando correctamente en `prd`
