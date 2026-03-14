# Pasos para levantar en Kubernetes on-prem

## 1. Crea el namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

## 2. Crea tu configmap local

1. Copia [configmap.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/configmap.example.yaml) a `k8s/configmap.yaml`
2. Ajusta:

- `PORT`
- `SNS_TOPIC_ARN`

3. Aplica:

```bash
kubectl apply -f k8s/configmap.yaml
```

## 3. Crea el secret de la aplicacion

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

## 4. Crea el imagePullSecret por primera vez

Usa el script [ecr-pull-secret.example.sh](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ecr-pull-secret.example.sh):

1. Copia [.aws-ecr.env.example](/Users/rubensedano/Documents/Codex/SESEvents/.aws-ecr.env.example) a `.aws-ecr.env`
2. Completa:

```env
AWS_ACCESS_KEY_ID=TU_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=TU_SECRET_KEY
AWS_REGION=us-east-1
ECR_REGISTRY=841435092050.dkr.ecr.us-east-1.amazonaws.com
NAMESPACE=prd
```

3. Cargalo en tu shell:

```bash
set -a
source .aws-ecr.env
set +a
```

4. Ejecuta:

```bash
bash k8s/ecr-pull-secret.example.sh
```

El script usa `docker run amazon/aws-cli` para obtener el password de ECR, asi que no necesitas instalar AWS CLI en esa maquina.

Esto crea el secret `ecr-pull-secret`, que ya está referenciado por `k8s/deployment.yaml`.

## 5. Despliega la aplicacion

1. Copia [deployment.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/deployment.example.yaml) a `k8s/deployment.yaml`
2. Reemplaza:

```yaml
image: REPLACE_WITH_ECR_REGISTRY/REPLACE_WITH_ECR_REPOSITORY:latest
```

Por tu imagen real de ECR, por ejemplo:

```yaml
image: 841435092050.dkr.ecr.us-east-1.amazonaws.com/prd/ms-sesevents:latest
```

3. Si necesitas modificar DNS para salida externa, el ejemplo ya deja configurado:

- `dnsPolicy: None`
- `8.8.8.8`
- `8.8.4.4`

4. Aplica:

```bash
cp k8s/deployment.example.yaml k8s/deployment.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 6. Verifica que levantó bien

```bash
kubectl -n prd get pods
kubectl -n prd get svc
kubectl -n prd rollout status deployment/ses-sns-events
```

## 7. Activa la renovacion automatica del token de ECR

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

El CronJob esta configurado para refrescar el secret cada 12 horas.

## 8. Verifica el cron de refresco

```bash
kubectl -n prd get cronjob
kubectl -n prd get jobs
```

## 9. Cuando ya funcione el deploy manual

Recién allí conviene activar el workflow de GitHub Actions para despliegue automático, porque ya tendrás:

- la imagen en ECR
- el `imagePullSecret` funcionando
- el `CronJob` renovando credenciales
- el deployment levantando correctamente en `prd`

## 10. Instala el Ingress Controller

Para bare metal/on-prem, puedes instalar NGINX Ingress con el manifiesto oficial:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.14.3/deploy/static/provider/baremetal/deploy.yaml
```

Espera a que quede listo:

```bash
kubectl -n ingress-nginx get pods
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
kubectl get ingressclass
```

Si tu HAProxy reenviara HTTP al Ingress Controller por `NodePort`, puedes tomar como base [ingress-controller-service.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ingress-controller-service.example.yaml):

```bash
kubectl apply -f k8s/ingress-controller-service.example.yaml
kubectl -n ingress-nginx get svc
```

## 11. Exponerlo por Ingress detras de HAProxy

Si tu HAProxy ya termina SSL, esta es la opcion recomendada.

1. Asegurate de tener un Ingress Controller instalado en Kubernetes
2. Si tu HAProxy reenviara al Ingress Controller por `NodePort`, puedes tomar como base [ingress-controller-service.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ingress-controller-service.example.yaml)
3. Copia [ingress.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ingress.example.yaml) a `k8s/ingress.yaml`
4. Cambia el `host` por tu dominio real, por ejemplo `ses.example.com`
5. Aplica:

```bash
cp k8s/ingress.example.yaml k8s/ingress.yaml
kubectl apply -f k8s/ingress.yaml
```

Tu HAProxy deberia reenviar trafico HTTP al Ingress Controller dentro del cluster o a su `NodePort` HTTP.

Verifica:

```bash
kubectl -n prd get ingress
kubectl -n prd describe ingress ses-sns-events
```

Si quieres probar antes de mover DNS, puedes hacer una prueba enviando manualmente el header `Host` hacia el NodePort HTTP del Ingress Controller:

```bash
curl -H "Host: ses.example.com" http://IP_DEL_NODO:30080/health
```

## 12. TLS opcional dentro de Kubernetes

Solo necesitas esto si mas adelante quieres que Kubernetes tambien maneje certificados.

1. Copia [ingress-tls.example.yaml](/Users/rubensedano/Documents/Codex/SESEvents/k8s/ingress-tls.example.yaml) a `k8s/ingress-tls.yaml`
2. Cambia el `host`
3. Crea el secret TLS:

```bash
kubectl -n prd create secret tls ses-sns-events-tls \
  --cert=/ruta/al/certificado.crt \
  --key=/ruta/a/la/llave.key
```

4. Aplica el ingress TLS:

```bash
kubectl apply -f k8s/ingress-tls.yaml
```
