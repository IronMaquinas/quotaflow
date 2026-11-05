import { useState, useCallback, useEffect } from "react";
import { soAreaRestrita } from "../utils/areaRestrita";
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
    setErro(null);
    
    const response = await apiService.get('/catalogo/admin', { params: filtros });

    setItens(response.itens || []);
  } catch (err) {
    setErro(err.message);
    console.error("Erro ao carregar:", err);
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
    if (soAreaRestrita()) return; // 18h.2: locatário/colaborador não acessam o catálogo (403 → loop de login)
    listar();
    carregarCategorias();
    carregarMarcas();
  }, []);

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