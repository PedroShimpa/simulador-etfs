# Simulador de Mercado Financeiro: ETFs de Renda Fixa vs Tesouro Direto vs CDBs de Caixinhas

> **Projeto Open Source criado por Pedro Falconi**  
> Licença MIT &bull; Integração com **B3 (Brasil, Bolsa, Balcão)**, **Tesouro Direto** e **BrasilAPI** &bull; Otimizado para **Vercel**

---

## 📌 Visão Geral

Este simulador foi projetado para auxiliar investidores e entusiastas do mercado financeiro brasileiro a calcularem e compararem os ganhos em **longo prazo** com **dados reais de mercado atualizados**:

1. **ETFs de Renda Fixa negociados na B3 (ex: B5P211, IMAB11, LFTS11, FIXA11)**:
   - Cotações e variações diárias em tempo real obtidas da **B3**.
   - Alíquota fixa de **15% de Imposto de Renda** (Lei 13.043/2014 para fundos com carteira de prazo médio > 720 dias).
   - **Sem come-cotas** (reinvestimento automático integral dos proventos no patrimônio).
   - **Isenção da taxa de custódia da B3** de 0,20% a.a. cobrada nos títulos do Tesouro Direto.
   - Cálculo automático da **quantidade de cotas acumuladas** com base no valor real da cota na B3.

2. **Tesouro Direto (Tesouro Selic e Tesouro IPCA+)**:
   - Taxas de compra oficiais vigentes obtidas da base de dados aberta do **Tesouro Nacional / B3**.
   - Taxa de custódia da B3 de **0,20% a.a.** (com isenção até R$ 10.000,00 no Tesouro Selic).
   - Tributação pela **Tabela Regressiva de IR** (22,5% a 15,0%), calculada lote a lote.

3. **CDBs de Caixinhas de Bancos Digitais (ex: Nubank, Inter, PicPay a 100% do CDI)**:
   - Liquidez diária imediata para reserva de emergência.
   - Garantia do FGC (Fundo Garantidor de Créditos) até R$ 250.000,00.
   - Tributação pela Tabela Regressiva de IR apurada aporte por aporte.

---

## 🚀 Publicação na Vercel

O projeto está 100% configurado para deploy imediato na **Vercel** com suporte a PHP Serverless e fallback client-side instantâneo:

1. Suba o repositório para o seu **GitHub**.
2. Acesse [vercel.com](https://vercel.com) e importe o repositório.
3. Clique em **Deploy**. O arquivo `vercel.json` cuidará de toda a infraestrutura automaticamente.

Para o passo a passo completo, veja o arquivo [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

---

## 💻 Execução Local

### No XAMPP
1. Mantenha os arquivos na pasta do XAMPP:
   ```
   d:\programas\xampp\htdocs\simulador-etfs\
   ```
2. Inicie o módulo **Apache** no painel do XAMPP e acesse:
   ```
   http://localhost/simulador-etfs/
   ```

### Via Servidor Embutido do PHP
No terminal da pasta do projeto:
```bash
php -S localhost:8000
```
E acesse no navegador: `http://localhost:8000`.

---

## 📊 Estrutura de Arquivos

```
simulador-etfs/
├── api/
│   ├── b3_dados.php     # Cotações de ETFs na B3 e taxas diárias do Tesouro Direto
│   ├── taxas.php        # Integração e cache com BrasilAPI (SELIC, CDI, IPCA)
│   └── simular.php      # Motor matemático de cálculo financeiro lote a lote
├── assets/
│   ├── css/
│   │   └── style.css    # Estilização visual premium com Bootstrap 5
│   └── js/
│       └── app.js       # Streaming de tickers, gráficos Chart.js e fallback local
├── index.php            # Interface principal com Monitor de Mercado B3
├── vercel.json          # Configuração serverless para a plataforma Vercel
├── .vercelignore        # Arquivos excluídos do pacote de deploy
├── DEPLOY_VERCEL.md     # Guia detalhado de deploy na Vercel
├── LICENSE              # Licença MIT
└── README.md            # Documentação do projeto
```

---

## 👤 Autor

**Pedro Falconi**  
Projeto Open Source para a comunidade brasileira de finanças e investimentos.

---

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** - consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
