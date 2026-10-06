class Produto {
    #preco;
    #quantidade;

    constructor(nome, preco, quantidade, id = null) {
        if (!nome || preco <= 0 || quantidade <= 0) {
            throw new Error('Dados inválidos para o produto.');
        }
        this.id = id;
        this.nome = nome;
        this.#preco = parseFloat(preco);
        this.#quantidade = parseInt(quantidade, 10);
    }

    get preco() { return this.#preco; }
    get quantidade() { return this.#quantidade; }
    valorTotal() { return this.#preco * this.#quantidade; }

    toJSON() {
        return {
            id: this.id,
            nome: this.nome,
            preco: this.#preco,
            quantidade: this.#quantidade
        };
    }
}

const API_URL = '/produtos';

async function renderizarTabela() {
    try {
        const resposta = await fetch(API_URL);
        if (!resposta.ok) throw new Error('Erro ao buscar produtos.');

        const dados = await resposta.json();
        const tabela = document.querySelector('#tabela-produtos tbody');
        tabela.innerHTML = '';

        let totalAcumulado = 0;

        dados.forEach((item) => {
            const produto = new Produto(item.nome, item.preco, item.quantidade, item.id);
            totalAcumulado += produto.valorTotal();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${produto.nome}</td>
                <td>R$ ${produto.preco.toFixed(2)}</td>
                <td>${produto.quantidade}</td>
                <td>R$ ${produto.valorTotal().toFixed(2)}</td>
                <td><button class="remover-produto" onclick="excluirProduto(${produto.id})">Remover produto</button></td>
            `;
            tabela.appendChild(row);
        });

        document.getElementById('total-estoque').textContent =
            `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;
    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
}

document.getElementById('produto-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const produto = new Produto(
            document.getElementById('nome').value,
            document.getElementById('preco').value,
            document.getElementById('quantidade').value
        );

        const resposta = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(produto.toJSON())
        });

        if (!resposta.ok) {
            const erro = await resposta.json();
            throw new Error(erro.erro || 'Erro ao salvar produto.');
        }

        e.target.reset();
        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
});

async function excluirProduto(id) {
    if (!confirm('Deseja remover esse produto?')) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (!resposta.ok) throw new Error('Erro ao remover o produto.');
        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

document.getElementById('limpar-tabela').addEventListener('click', async () => {
    if (!confirm('Deseja mesmo limpar toda a tabela?')) return;

    try {
        const resposta = await fetch(API_URL, { method: 'DELETE' });
        if (!resposta.ok) throw new Error('Erro ao limpar a tabela.');
        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
});

renderizarTabela();

