require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    })
    : null;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/produtos', async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM produtos ORDER BY id ASC'
        );

        res.status(200).json(result.rows);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);

        res.status(500).json({
            erro: 'Erro ao buscar produtos',
            detalhe: erro.message
        });
    }
});

app.post('/produtos', async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    const { nome, preco, quantidade } = req.body;
    const p = Number(preco);
    const q = Number(quantidade);

    if (!nome || !Number.isFinite(p) || !Number.isInteger(q) || p <= 0 || q <= 0) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO produtos(nome, preco, quantidade) VALUES($1, $2, $3) RETURNING *',
            [nome, p, q]
        );

        res.status(201).json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);

        res.status(500).json({
            erro: 'Erro ao inserir produto',
            detalhe: erro.message
        });
    }
});

app.delete('/produtos/:id', async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        const result = await pool.query(
            'DELETE FROM produtos WHERE id = $1',
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }

        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao deletar produto',
            detalhe: erro.message
        });
    }
});

app.delete('/produtos', async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        await pool.query('DELETE FROM produtos');
        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao limpar produtos',
            detalhe: erro.message
        });
    }
});

module.exports = app;
