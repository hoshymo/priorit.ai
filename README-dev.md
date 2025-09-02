## 開発者向け README


## 実行のしかた

backend/.env に Gemini API key を設定する

```backend/.env
REACT_APP_GEMINI_API_KEY=xxxxxxxxxx
```

### Backend 起動

Gemini API を呼び出す server は backend として常時起動しておく必要があります。

```bash
cd backend
npm i
npm start
```

#### container を使う場合

```bash
docker build -t test .
docker run -it --init --rm -e REACT_APP_GEMINI_API_KEY=xxxx -p 127.0.0.1:3001:3001 test
```

### Frontend 起動

web UI の frontend server です。release 版では build した static 版を使用しますが、開発中は React の dev server を起動して使います。

```bash
npm i
npm start
```

## 開発のしかた

### backend API の test 方法

```bash
curl "http://localhost:3001/api/generate" \
  -H "Authorization: Bearer <Firebase ID Token>" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt": "aaaa"}'
```

### backend で Firebase auth ID token の検証も動作させる方法

環境変数 GOOGLE_APPLICATION_CREDENTIALS に SA key file の path または file の中身を直接入れておきます。
key file は Firebase console の設定から取得できます。

```console
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
```

ID token の検証をスキップするにはこの環境変数を unset しておきます。この場合も Authorization header はつけてないと認証エラーになります。

```console
unset GOOGLE_APPLICATION_CREDENTIALS; export GOOGLE_APPLICATION_CREDENTIALS
```

また、package.json で npm start したときに以下の環境変数が設定されるようにしているので、これも除外して起動してください。

```console
PASS_ID_TOKEN_VERIFY=true
```

### container build ~ Cloud Run への deploy

GitHub Actions で Artifact Registry へ push、Cloud Run へ deploy するまでのやりかた

これを参考にする
https://zenn.dev/team_delta/articles/google_cloud_1

#### 実際に上記を実行したときの memo

```bash
# RGN=us-central1
PRJID=hoshymo
PRJNU=1064199407438
RGN=asia-northeast1
REPO_NAME=priorit-ai
SA_NAME=ghactions
POOL_NAME=ghactions
PROVIDER_NAME=oidc-gh-1
GHORG=hoshymo
GHREPO=priorit.ai

gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=$RGN

gcloud auth configure-docker $RGN-docker.pkg.dev

gcloud iam service-accounts create $SA_NAME --display-name="GitHub Actions"
gcloud projects add-iam-policy-binding $PRJID \
    --member="serviceAccount:$SA_NAME@$PRJID.iam.gserviceaccount.com" \
    --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PRJID \
    --member="serviceAccount:$SA_NAME@$PRJID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $PRJID \
    --member="serviceAccount:$SA_NAME@$PRJID.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

gcloud services enable run.googleapis.com --project=$PRJID
gcloud services enable iamcredentials.googleapis.com --project=$PRJID
gcloud iam workload-identity-pools create $POOL_NAME --location="global" --project=$PRJID
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
    --project="$PRJID" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-condition="assertion.repository_owner=='$GHORG/$GHREPO'"
    # owner/repo という条件になっているが、owner だけにしないと弾かれるような気がする
gcloud iam service-accounts add-iam-policy-binding $SA_NAME@$PRJID.iam.gserviceaccount.com \
  --project="$PRJID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PRJNU/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GHORG/$GHREPO"

# やりなおし用
gcloud iam workload-identity-pools providers delete $PROVIDER_NAME \
    --project="$PRJID" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME"
```

## Firebase project の追加のしかた

GCP project を新しく set up するときの手順

- Firebase web console から新しく project を追加する
- 新規の project としてではなく、GCP project に Firebase project を追加する方法を選択する
- project ができたら以下を有効にする
  - Authentication
    - Sign-in method で Google を有効にする
  - Firestore Database
    - (default) database をつくる。Rule に、sign-in user のみ読み書きできるルールを追加する
- Project settings のところから web app を追加し、firebaseConfig を生成して firebase.ts に移す。firebaseConfig: {} のみ移すようにし、周辺のコードはコピペしてこないほうがよい。今後のメンテのことを考えるとそのまま持ってきて動くようにしたほうが良いかもしれない。

※ Cloud Run で ID token verification する project が、frontend から送る ID token を生成する (Firebase Auth で使っている) project とおなじになっている必要がある ("aud" が合っている必要がある) ことに注意。逆の言い方をすると、Cloud Run と Firebase Auth が別 project で動作するようにする場合は何か工夫が必要。


## Troubleshooting

### Firebase Admin API の getAuth() でエラー

```console
/home/hoshymo/projects/priorit.ai/node_modules/@firebase/app/dist/index.cjs.js:275
        .getProvider('heartbeat')
         ^

TypeError: Cannot read properties of undefined (reading 'getProvider')
    at Object._getProvider (/home/hoshymo/projects/priorit.ai/node_modules/@firebase/app/dist/index.cjs.js:275:10)
```

たぶん Firebase Admin API の initializeApp() で default service account が設定できていない。
以下などして SA をつくって ADC を設定する。

```console
gcloud iam service-accounts create priorit-ai-backend --display-name="priorit-ai-backend"
gcloud auth application-default login --impersonate-service-account=priorit-ai-backend@hoshymo.iam.gserviceaccount.com     
```

→ 解決方法はひとつ下を参照。

### Firebase Admin API の getAuth() でエラー

```console
/home/hoshymo/projects/priorit.ai/node_modules/@firebase/app/dist/index.cjs.js:729
        throw ERROR_FACTORY.create("no-app" /* AppError.NO_APP */, { appName: name });
                            ^

FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app).
```

以下のように、 `getAuth().verifyIdToken()` ではなく `admin.auth().verifyIdToken` を使う必要がある。
[この document](https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_the_firebase_admin_sdk) は何なのか...

```ts
  // getAuth(fb)
  await admin.auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
        // ...
    });
```
