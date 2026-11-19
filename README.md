# Horizonte — Simulador financeiro com cenários

Site estático, responsivo e gratuito (HTML, CSS, JavaScript). Sem servidor, contas, dependências ou chamadas externas.

## Funcionalidades

- Simulação de saldo, renda, despesas, juros do cheque especial e IOF **estimados** em 12 meses.
- Mudanças programadas em datas específicas. Para renda/gasto **recorrente**, a nova quantia passa a valer para o **mês inteiro** da data e permanece até outra mudança. Entradas ou despesas pontuais valem somente no mês indicado.
- Gráfico de evolução, detalhamento mensal e exportação CSV.
- **Salvar cenários com nome**, carregar, comparar e excluir até 50 versões neste navegador.
- Comparação A vs. B com saldo final, juros, IOF, gastos, gráfico sobreposto e diferença dos saldos **por mês de calendário**. Se os cenários começarem em meses distintos, a tabela mostra "—" nos meses sem correspondência.
- **Backup JSON completo** com versão atual e todas as versões salvas, importável em outro navegador. Também importa o formato JSON antigo de simulação individual.

## Como publicar de graça no GitHub Pages

1. Na sua conta GitHub, crie um repositório público, por exemplo **`horizonte-financeiro`** (https://github.com/new).
2. Faça upload dos arquivos `index.html`, `styles.css` e `script.js` **na raiz do repositório**, não dentro de uma subpasta. Se quiser, inclua o `README.md` e `.nojekyll`.
3. Faça commit dos arquivos na branch `main`.
4. Abra **Settings → Pages → Build and deployment**.
5. Selecione **Source: Deploy from a branch** → **Branch: main** → **Folder: / (root)** → **Save**.
6. Quando o GitHub Pages concluir a publicação, a URL terá o formato `https://SEU-USUARIO.github.io/horizonte-financeiro/`.

Um novo commit em `main` atualiza o site publicado. **Não é necessário criar token de acesso, variável de ambiente nem processo de build.**

> Para GitHub Free, o repositório precisa ser público. Apenas o código do site é público, **não os dados salvos pelos visitantes**.

### Alternativa de hospedagem

Use https://app.netlify.com/drop e arraste a pasta descompactada contendo `index.html`, `styles.css` e `script.js`.

## Salvar, carregar e comparar

1. Configure sua projeção e suas mudanças.
2. No painel **Cenários salvos**, informe um nome e clique em **Salvar versão atual**.
3. Altere os valores da calculadora e salve outra versão, ou compare diretamente o que está editando com a primeira versão.
4. Em **Comparar cenários**, selecione **Cenário A** e **Cenário B**. A diferença exibida é sempre `B − A`.
5. Para levar seus dados para outro dispositivo, clique em **Baixar backup completo (.json)** e importe o arquivo no outro navegador.

**Privacidade/persistência:** cenário atual e versões são armazenados em `localStorage`, ou seja, somente no navegador/perfil/dispositivo usado. Não há sincronização online ou por conta. Limpar os dados do navegador, usar modo anônimo ou trocar de dispositivo pode apagar as versões. Faça backup JSON regularmente. Importar um backup completo substitui o conjunto de versões locais; importar uma simulação antiga substitui apenas os dados atuais.

## Modelo financeiro — atenção

Este é um **planejador mensal simplificado**, não uma reprodução exata do extrato bancário.

- Saldo final = saldo inicial do mês + renda + entradas pontuais − gasto recorrente − despesas pontuais − encargos estimados.
- Juros estimados incidem sobre o saldo negativo **no início do mês** (taxa mensal indicada). Uma dívida nova gerada no mês só passa a sofrer juros **no próximo mês**; isso é uma convenção de planejamento, não a regra de cálculo real do banco.
- IOF diário estimado: dívida inicial × 0,0082% × dias do mês. Adicional de 0,38% é estimado sobre o aumento líquido de utilização do especial (antes dos encargos) e lançado no período seguinte. O cálculo real do IOF pode divergir consideravelmente, sobretudo no mês da nova utilização.
- Saldos positivos não recebem rendimento.

No banco, os encargos dependem do **saldo devedor diário**, das datas efetivas de entradas/saídas, eventuais isenções e do contrato. Este simulador serve para analisar alternativas financeiras, não para conferir uma fatura de juros/IOF com precisão contábil. Confira taxas e cobranças da instituição.

## Arquivos

- `index.html` — interface responsiva.
- `styles.css` — estilos do site.
- `script.js` — simulação, mudanças, gráfico, persistência, cenários e exportação/importação.
- `.nojekyll` — desativa o processamento Jekyll no GitHub Pages.
- `test-simulator.cjs` — testes da simulação mensal (`node test-simulator.cjs`).
