# 🚀 Guia de Publicação no Vercel - Simulador de ETFs

> **Projeto Open Source criado por Pedro Falconi**  
> Totalmente otimizado para deploy *zero-configuration* na **Vercel**

---

## 🛠️ Opção 1: Deploy Rápido via GitHub (Recomendado)

1. **Suba o projeto para um repositório no seu GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: Simulador de ETFs e Renda Fixa - Pedro Falconi"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/simulador-etfs.git
   git push -u origin main
   ```

2. **Importe na Vercel**:
   - Acesse [vercel.com](https://vercel.com) e faça login com seu GitHub.
   - Clique em **"Add New..."** ➔ **"Project"**.
   - Selecione o repositório `simulador-etfs`.
   - Clique em **"Deploy"** (o arquivo `vercel.json` configurará automaticamente o ambiente serverless com PHP e cache em Edge).

---

## 💻 Opção 2: Deploy Direto via Vercel CLI (Terminal)

Se você tiver o Node.js instalado:

1. **Instale a Vercel CLI globalmente**:
   ```bash
   npm install -g vercel
   ```

2. **Execute o comando de deploy dentro da pasta do projeto**:
   ```bash
   vercel
   ```

3. **Para deploy direto em produção**:
   ```bash
   vercel --prod
   ```

---

## ⚡ Otimizações Implementadas para a Vercel

1. **`vercel.json` Integrado**:
   - Configurado com a runtime `vercel-php@0.7.3` para execução serverless de `index.php` e endpoints em `/api/`.
   - Roteamento otimizado de arquivos estáticos (`/assets/`) com cabeçalhos de cache HTTP agressivo (`max-age=31536000, immutable`).

2. **Arquitetura de Cache em `/tmp`**:
   - Ambientes AWS Lambda na Vercel possuem sistema de arquivos em modo *Read-Only* exceto pelo diretório `/tmp`.
   - Os módulos `api/taxas.php` e `api/b3_dados.php` foram otimizados para usar `sys_get_temp_dir()`, garantindo que o cache funcione sem falhas de permissão.

3. **CORS Habilitado**:
   - Cabeçalhos `Access-Control-Allow-Origin: *` habilitados em todas as APIs, permitindo que previews em URLs dinâmicas da Vercel (`*.vercel.app`) funcionem perfeitamente.

4. **Motor Híbrido com Fallback Client-Side**:
   - Caso uma requisição serverless sofra com *cold-start* ou limitações de rede temporárias, o JavaScript (`app.js`) ativa automaticamente um motor de cálculo idêntico no navegador, garantindo **100% de disponibilidade contínua** para o usuário.

5. **`.vercelignore` Otimizado**:
   - Evita o envio de arquivos de testes locais, caches antigos e artefatos de desenvolvimento.
