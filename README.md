## 🌿 Git Workflow

### 1️⃣ Clone the Repo
```bash
git clone git@github.com:dsauce817/GainOS.git
cd GainOS
```

---

### 2️⃣ Create a Development Branch (Never Work on `main`)
```bash
git checkout -b dev
git push -u origin dev
```

---

### 3️⃣ Daily Development Workflow
```bash
git add .
git commit -m "Describe what you changed"
git push
```

(Automatically pushes to your current branch.)

---

### 4️⃣ Create a Feature Branch (Recommended)
```bash
git checkout -b feature/feature-name
git push -u origin feature/feature-name
```

Example:
```bash
git checkout -b feature/auth-flow
```

---

### 5️⃣ Merge `dev` into `main` When Ready to Ship
```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

---

## 🔒 Important

Never commit:
- `.env.local`
- `.env`
- `ios/`
- `android/`
- `node_modules/`

Only `.env.example` should be committed.

---

## 🧠 Branch Strategy

- `main` → Production
- `dev` → Active development
- `feature/*` → Small changes or experiments