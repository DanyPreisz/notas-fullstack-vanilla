# Notas

Bloc de notas fullstack, sin frameworks de frontend.

- CRUD de notas
- Busqueda por titulo, texto y categoria
- Categorias por usuario
- MongoDB Atlas
- Listo para Cloud Run

## Local

```bash
export MONGODB_URI="mongodb+srv://..."
export MONGODB_DB=notas
npm install
node server/index.js
```

## Cloud Run

```bash
export PROJECT_ID="tu-proyecto"
export MONGODB_URI="mongodb+srv://..."
export JWT_SECRET="$(openssl rand -hex 32)"

gcloud run deploy notas-fullstack \
  --region europe-west1 \
  --source . \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars "MONGODB_URI=${MONGODB_URI},MONGODB_DB=notas,JWT_SECRET=${JWT_SECRET}"
```

En Atlas, Network Access tiene que permitir `0.0.0.0/0`.
