# Git Setup Guide - SAAI Platform

Complete instructions for initializing Git, creating a GitHub repository, and pushing your code.

## Prerequisites

- Git installed locally ([Download Git](https://git-scm.com/downloads))
- GitHub account ([Sign up](https://github.com/join))
- VS Code (recommended) or terminal access

## Method 1: Using VS Code (Recommended)

### Step 1: Initialize Git Repository

1. **Open VS Code** with the SAAI platform workspace
   ```bash
   code /home/sali/saai-platform
   ```

2. **Open Source Control panel:**
   - Click the Source Control icon in the left sidebar (looks like a branch)
   - OR press `Ctrl+Shift+G` (Linux/Windows) or `Cmd+Shift+G` (Mac)

3. **Initialize Repository:**
   - Click "Initialize Repository" button
   - This creates a `.git` folder in your workspace

### Step 2: Stage Files

1. **Review changes:**
   - Source Control panel will show all untracked files
   - Review the list to ensure no sensitive files are included
   - `.gitignore` should prevent `.env`, `node_modules/`, etc.

2. **Stage all files:**
   - Click the `+` icon next to "Changes" to stage all files
   - OR stage individual files by clicking `+` next to each file

### Step 3: Commit Changes

1. **Write commit message:**
   - In the message box at the top, type:
     ```
     Initial SAAI platform commit - Multi-tenant AI chat platform
     ```

2. **Commit:**
   - Click the ✓ checkmark button (or press `Ctrl+Enter`)
   - Files are now committed to your local Git repository

### Step 4: Publish to GitHub

1. **Click "Publish Branch":**
   - VS Code will show a "Publish Branch" button in Source Control
   - Click it

2. **Choose repository visibility:**
   - **Public**: Anyone can see this repository
   - **Private**: Only you and collaborators can see it
   - Choose based on your needs

3. **Name your repository:**
   - Suggested name: `saai-platform`
   - VS Code will create the repository on GitHub automatically

4. **Wait for upload:**
   - VS Code will push all commits to GitHub
   - A notification will appear when complete

5. **View on GitHub:**
   - Click "Open on GitHub" in the notification
   - OR go to `https://github.com/YOUR_USERNAME/saai-platform`

### Step 5: Verify Upload

1. **Check GitHub repository:**
   - Ensure all files are present
   - Verify `.env` files are NOT uploaded (should be ignored)
   - Check that `README.md` displays correctly

2. **Verify branch:**
   - Default branch should be `main`
   - If not, you can change it in GitHub Settings → Branches

## Method 2: Using Command Line

### Step 1: Initialize Git

```bash
cd /home/sali/saai-platform

# Initialize Git repository
git init

# Verify .gitignore exists
ls -la .gitignore

# Check Git status
git status
```

### Step 2: Configure Git (First Time Only)

```bash
# Set your name (replace with your name)
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your.email@example.com"

# Verify configuration
git config --list
```

### Step 3: Add Files

```bash
# Add all files (respects .gitignore)
git add .

# Verify what will be committed
git status

# Check that sensitive files are ignored
git status --ignored
```

**Expected output:**
- `.env` files should be in "Ignored files" section
- `node_modules/` should be ignored
- All source code files should be staged

### Step 4: Commit Changes

```bash
# Create initial commit
git commit -m "Initial SAAI platform commit - Multi-tenant AI chat platform

- Multi-tenant backend with Express.js
- Next.js frontend with dynamic theming
- LLM integration (Groq, Gemini, Mistral)
- Security hardening (Helmet, CORS, rate limiting)
- Action orchestrator with adapter pattern
- Tenant configuration system
- Complete documentation"

# Verify commit
git log --oneline
```

### Step 5: Create GitHub Repository

**Option A: Using GitHub CLI (gh)**

```bash
# Install GitHub CLI if needed
# Ubuntu/Debian: sudo apt install gh
# Mac: brew install gh

# Login to GitHub
gh auth login

# Create repository (choose public or private)
gh repo create saai-platform --public --source=. --remote=origin --push

# Repository is created and code is pushed automatically!
```

**Option B: Using GitHub Web Interface**

1. **Go to GitHub:**
   - Navigate to https://github.com/new

2. **Create repository:**
   - Repository name: `saai-platform`
   - Description: "Multi-tenant AI chat platform with Next.js and Express"
   - Visibility: Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

3. **Copy the repository URL:**
   - SSH: `git@github.com:YOUR_USERNAME/saai-platform.git`
   - HTTPS: `https://github.com/YOUR_USERNAME/saai-platform.git`

### Step 6: Push to GitHub

```bash
# Add GitHub as remote origin (replace YOUR_USERNAME)
git remote add origin git@github.com:YOUR_USERNAME/saai-platform.git

# OR use HTTPS if you prefer:
# git remote add origin https://github.com/YOUR_USERNAME/saai-platform.git

# Verify remote
git remote -v

# Rename branch to 'main' (if using 'master')
git branch -M main

# Push to GitHub
git push -u origin main
```

**If push fails with authentication error:**

**For SSH:**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your.email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
# Paste the key and save
```

**For HTTPS:**
```bash
# You'll be prompted for username and password
# Use a Personal Access Token instead of password
# Generate token: GitHub → Settings → Developer settings → Personal access tokens
```

## Verification Checklist

After pushing to GitHub, verify:

- [ ] Repository is created on GitHub
- [ ] All code files are present
- [ ] `.env` files are NOT present (check ignored files)
- [ ] `node_modules/` is NOT uploaded
- [ ] `README.md` renders correctly on GitHub
- [ ] LICENSE file is present
- [ ] `.gitignore` is present
- [ ] Documentation files are in `/Docs/`

## Common Issues & Solutions

### Issue: .env file was committed

**Solution:**
```bash
# Remove from Git but keep locally
git rm --cached backend/.env

# Commit the removal
git commit -m "Remove .env from version control"

# Push changes
git push
```

### Issue: node_modules/ was committed

**Solution:**
```bash
# Remove from Git
git rm -r --cached backend/node_modules frontend/node_modules

# Commit the removal
git commit -m "Remove node_modules from version control"

# Push changes
git push
```

### Issue: Wrong branch name (master instead of main)

**Solution:**
```bash
# Rename branch locally
git branch -M main

# Delete old branch on GitHub (if already pushed)
git push origin --delete master

# Push new branch
git push -u origin main

# Set main as default on GitHub:
# Repository → Settings → Branches → Default branch → Switch to main
```

### Issue: Permission denied (publickey)

**Solution:**
```bash
# Check SSH connection
ssh -T git@github.com

# If fails, add SSH key to GitHub:
# 1. Generate key: ssh-keygen -t ed25519 -C "your.email@example.com"
# 2. Copy key: cat ~/.ssh/id_ed25519.pub
# 3. Add to GitHub: Settings → SSH keys → New SSH key

# Or switch to HTTPS:
git remote set-url origin https://github.com/YOUR_USERNAME/saai-platform.git
```

## Next Steps

After successfully pushing to GitHub:

1. **Review repository on GitHub:**
   - Check that README displays correctly
   - Verify all files are present
   - Review commit history

2. **Set up branch protection (recommended):**
   - Go to Settings → Branches
   - Add rule for `main` branch
   - Enable "Require pull request reviews before merging"

3. **Add collaborators (if needed):**
   - Go to Settings → Collaborators
   - Invite team members

4. **Deploy to Vercel:**
   - See [DEPLOYMENT.md](./DEPLOYMENT.md) for instructions

5. **Set up CI/CD (optional):**
   - GitHub Actions for automated testing
   - Deploy previews for pull requests

## Git Workflow for Future Changes

```bash
# 1. Make changes to code
# (edit files in VS Code or your editor)

# 2. Check what changed
git status
git diff

# 3. Stage changes
git add .

# 4. Commit with descriptive message
git commit -m "Add user authentication feature"

# 5. Push to GitHub
git push

# That's it! Changes are now on GitHub
```

## Best Practices

### Commit Messages

Use clear, descriptive commit messages:

**Good:**
```
✅ Add rate limiting to protect API endpoints
✅ Fix tenant theme loading bug
✅ Update README with deployment instructions
```

**Bad:**
```
❌ Fixed stuff
❌ Update
❌ Changes
```

### Commit Frequency

- Commit often (after each logical change)
- Don't commit broken code to `main`
- Test locally before pushing

### Branch Strategy (for teams)

```bash
# Create feature branch
git checkout -b feature/user-authentication

# Make changes and commit
git add .
git commit -m "Add user authentication"

# Push feature branch
git push -u origin feature/user-authentication

# Create Pull Request on GitHub
# After review, merge to main
```

## Security Reminders

⚠️ **NEVER commit:**
- `.env` files
- API keys
- Passwords
- Private keys
- Credentials

✅ **Always:**
- Use `.gitignore`
- Review `git status` before committing
- Use environment variables for secrets
- Rotate API keys if accidentally committed

## Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [VS Code Git Tutorial](https://code.visualstudio.com/docs/editor/versioncontrol)
- [GitHub CLI](https://cli.github.com/)

---

**You're now ready to manage your SAAI platform on GitHub!** 🎉

Proceed to [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.
