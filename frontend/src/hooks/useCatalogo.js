import { useState, useCallback, useEffect } from "react";
import apiService from "../services/apiService";

export function useCatalogo() {
  const [itens, setItens] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const listar = useCallback(async (filtros = {}) => {
    try {
      setLoading(true);
      const response = await apiService.get('/catalogo/admin', { params: filtros });
      setItens(response.itens || []);
    } catch (err) {
      console.error("Erro ao listar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarCategorias = useCallback(async () => {
    try {
      const response = await apiService.get('/catalogo/categorias');
      setCategorias(response.categorias || []);
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  }, []);

  const carregarMarcas = useCallback(async () => {
    try {
      const response = await apiService.get('/catalogo/marcas');
      setMarcas(response.marcas || []);
    } catch (err) {
      console.error("Erro ao carregar marcas:", err);
    }
  }, []);

  useEffect(() => {
    listar();
    carregarCategorias();
    carregarMarcas();
  }, [listar, carregarCategorias, carregarMarcas]);

  return {
    itens,
    setItens,
    categorias,
    marcas,
    loading,
    erro,
    listar,
    carregarCategorias,
    carregarMarcas,
  };
}