// frontend/src/components/configuracoes/TelaConfiguracoes.jsx
//
// Tela de configurações do tenant. v1 cobre:
//   - Jornada de trabalho (padrão)
//   - Feriados do calendário
//
// Padrão: mesmo estilo visual da TelaOrdemServico, com tabs no topo.
// Componente auto-contido — só precisa das props `C` e `s` (o design
// system), igual às outras telas.

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";

// ─────────────────────────────────────────────────────────────────────────
// HELPERS de conversão minuto ↔ HH:MM
// ─────────────────────────────────────────────────────────────────────────
function minParaHora(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function horaParaMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export default function TelaConfiguracoes({ C, s }) {
  const [abaAtiva, setAbaAtiva] = useState("jornada");
  const [erro, setErro] = useState(null);

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
          CONFIGURAÇÕES
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          Jornada & Calendário
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20,
                    borderBottom: `1px solid ${C.border}` }}>
        {[
          { id: "jornada", label: "⏰ Jornada de trabalho" },
          { id: "feriados", label: "📅 Feriados" },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => { setAbaAtiva(tab.id); setErro(null); }}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: abaAtiva === tab.id
                ? `2px solid ${C.accent}`
                : "2px solid transparent",
              color: abaAtiva === tab.id ? C.text : C.muted,
              fontSize: 13,
              fontWeight: abaAtiva === tab.id ? 600 : 400,
              cursor: "pointer",
              padding: "8px 16px 12px 16px",
              fontFamily: "inherit",
              marginBottom: -1,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {erro && (
        <div style={{ padding: "10px 12px", background: "#ef444415",
                      border: "1px solid #ef444440", borderRadius: 6,
                      fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
          ⚠ {erro}
        </div>
      )}

      {abaAtiva === "jornada" && <SecaoJornada C={C} s={s} onErro={setErro} />}
      {abaAtiva === "feriados" && <SecaoFeriados C={C} s={s} onErro={setErro} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SEÇÃO: JORNADA DE TRABALHO
// ═════════════════════════════════════════════════════════════════════════
function SecaoJornada({ C, s, onErro }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Estado do form
  const [form, setForm] = useState({
    nome: "Jornada padrão",
    hora_inicio: "08:00",
    hora_fim: "18:00",
    possui_intervalo: true,
    intervalo_inicio: "12:00",
    intervalo_fim: "13:00",
    descontar_intervalo: true,
    calcular_extra_auto: true,
    tolerancia_extra_min: 15,
    regra_segunda: "normal",
    regra_terca: "normal",
    regra_quarta: "normal",
    regra_quinta: "normal",
    regra_sexta: "normal",
    regra_sabado: "normal",
    regra_domingo: "excepcional",
  });

  // Carrega jornada existente
  useEffect(() => {
    setCarregando(true);
    apiService.get("/configuracoes/jornada")
      .then(j => {
        if (!j) return;
        setForm({
          nome: j.nome || "Jornada padrão",
          hora_inicio: minParaHora(j.hora_inicio_min),
          hora_fim: minParaHora(j.hora_fim_min),
          possui_intervalo: !!j.possui_intervalo,
          intervalo_inicio: minParaHora(j.intervalo_inicio_min) || "12:00",
          intervalo_fim: minParaHora(j.intervalo_fim_min) || "13:00",
          descontar_intervalo: !!j.descontar_intervalo,
          calcular_extra_auto: j.calcular_extra_auto !== false,
          tolerancia_extra_min: j.tolerancia_extra_min || 0,
          regra_segunda: j.regra_segunda || "normal",
          regra_terca: j.regra_terca || "normal",
          regra_quarta: j.regra_quarta || "normal",
          regra_quinta: j.regra_quinta || "normal",
          regra_sexta: j.regra_sexta || "normal",
          regra_sabado: j.regra_sabado || "normal",
          regra_domingo: j.regra_domingo || "excepcional",
        });
      })
      .catch(e => onErro?.(e.message || "Erro ao carregar jornada"))
      .finally(() => setCarregando(false));
  }, [onErro]);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    setSucesso(false);
    onErro?.(null);

    const inicioMin = horaParaMin(form.hora_inicio);
    const fimMin = horaParaMin(form.hora_fim);
    if (inicioMin == null || fimMin == null) {
      onErro?.("Informe horários válidos (HH:MM)");
      return;
    }
    if (inicioMin >= fimMin) {
      onErro?.("Hora de início deve ser anterior à hora de fim");
      return;
    }

    const payload = {
      nome: form.nome,
      hora_inicio_min: inicioMin,
      hora_fim_min: fimMin,
      possui_intervalo: form.possui_intervalo,
      intervalo_inicio_min: form.possui_intervalo ? horaParaMin(form.intervalo_inicio) : null,
      intervalo_fim_min: form.possui_intervalo ? horaParaMin(form.intervalo_fim) : null,
      descontar_intervalo: form.descontar_intervalo,
      calcular_extra_auto: form.calcular_extra_auto,
      tolerancia_extra_min: parseInt(form.tolerancia_extra_min) || 0,
      regra_segunda: form.regra_segunda,
      regra_terca: form.regra_terca,
      regra_quarta: form.regra_quarta,
      regra_quinta: form.regra_quinta,
      regra_sexta: form.regra_sexta,
      regra_sabado: form.regra_sabado,
      regra_domingo: form.regra_domingo,
    };

    setSalvando(true);
    try {
      await apiService.post("/configuracoes/jornada", payload);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch (e) {
      onErro?.(e.message || "Erro ao salvar jornada");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div style={{ color: C.muted, padding: 20 }}>Carregando configuração...</div>;
  }

  const regras = [
    { id: "normal", label: "Trabalho normal" },
    { id: "excepcional", label: "Excepcional (100%)" },
    { id: "folga", label: "Folga (não trabalha)" },
  ];

  const diasSemana = [
    { campo: "regra_segunda", label: "Segunda" },
    { campo: "regra_terca", label: "Terça" },
    { campo: "regra_quarta", label: "Quarta" },
    { campo: "regra_quinta", label: "Quinta" },
    { campo: "regra_sexta", label: "Sexta" },
    { campo: "regra_sabado", label: "Sábado" },
    { campo: "regra_domingo", label: "Domingo" },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Bloco 1: Horário base */}
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 14 }}>
          JORNADA PADRÃO
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>NOME</label>
          <input type="text" value={form.nome}
            onChange={e => set("nome", e.target.value)}
            style={s.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={s.label}>INÍCIO</label>
            <input type="time" value={form.hora_inicio}
              onChange={e => set("hora_inicio", e.target.value)}
              style={s.input} />
          </div>
          <div>
            <label style={s.label}>FIM</label>
            <input type="time" value={form.hora_fim}
              onChange={e => set("hora_fim", e.target.value)}
              style={s.input} />
          </div>
        </div>
      </div>

      {/* Bloco 2: Intervalo */}
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8,
                        cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={form.possui_intervalo}
            onChange={e => set("possui_intervalo", e.target.checked)} />
          <span style={{ fontSize: 12, color: C.text }}>
            A jornada possui <strong>intervalo de almoço/descanso</strong>
          </span>
        </label>

        {form.possui_intervalo && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                          marginBottom: 12 }}>
              <div>
                <label style={s.label}>INÍCIO DO INTERVALO</label>
                <input type="time" value={form.intervalo_inicio}
                  onChange={e => set("intervalo_inicio", e.target.value)}
                  style={s.input} />
              </div>
              <div>
                <label style={s.label}>FIM DO INTERVALO</label>
                <input type="time" value={form.intervalo_fim}
                  onChange={e => set("intervalo_fim", e.target.value)}
                  style={s.input} />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8,
                            cursor: "pointer" }}>
              <input type="checkbox" checked={form.descontar_intervalo}
                onChange={e => set("descontar_intervalo", e.target.checked)} />
              <span style={{ fontSize: 11, color: C.text }}>
                Descontar o intervalo automaticamente das horas trabalhadas
              </span>
            </label>
          </>
        )}
      </div>

      {/* Bloco 3: Hora extra */}
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 14 }}>
          HORA EXTRA
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8,
                        cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={form.calcular_extra_auto}
            onChange={e => set("calcular_extra_auto", e.target.checked)} />
          <span style={{ fontSize: 12, color: C.text }}>
            Calcular horas extras <strong>automaticamente</strong> quando o
            funcionário trabalhar fora da jornada
          </span>
        </label>

        {form.calcular_extra_auto && (
          <div>
            <label style={s.label}>TOLERÂNCIA (minutos)</label>
            <input type="number" min="0" value={form.tolerancia_extra_min}
              onChange={e => set("tolerancia_extra_min", e.target.value)}
              style={{ ...s.input, maxWidth: 120 }} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              Ex: 15min = só conta como extra se passar de 15 minutos além da jornada
            </div>
          </div>
        )}
      </div>

      {/* Bloco 4: Regras por dia da semana */}
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 6 }}>
          REGRA POR DIA DA SEMANA
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
          Define como as horas são tratadas em cada dia. Domingos e feriados
          geralmente são <strong>Excepcionais</strong> (adicional de 100%).
        </div>

        {diasSemana.map(({ campo, label }) => (
          <div key={campo} style={{ display: "grid", gridTemplateColumns: "120px 1fr",
                                    gap: 10, alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.text }}>{label}</div>
            <select value={form[campo]}
              onChange={e => set(campo, e.target.value)}
              style={{ ...s.input, appearance: "none", padding: "6px 10px", fontSize: 12 }}>
              {regras.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Ação */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={salvar} disabled={salvando}
          style={{ ...s.btn(true), padding: "10px 24px", fontSize: 13,
                   opacity: salvando ? 0.5 : 1 }}>
          {salvando ? "Salvando..." : "Salvar configuração"}
        </button>
        {sucesso && (
          <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>
            ✅ Configuração salva
          </span>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SEÇÃO: FERIADOS
// ═════════════════════════════════════════════════════════════════════════
function SecaoFeriados({ C, s, onErro }) {
  const [feriados, setFeriados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    data: "", nome: "", tipo: "nacional", pais: "BR",
  });

  const carregar = useCallback(() => {
    setCarregando(true);
    apiService.get("/configuracoes/feriados")
      .then(lista => setFeriados(Array.isArray(lista) ? lista : []))
      .catch(e => onErro?.(e.message || "Erro ao carregar feriados"))
      .finally(() => setCarregando(false));
  }, [onErro]);

  useEffect(() => { carregar(); }, [carregar]);

  function resetForm() {
    setForm({ data: "", nome: "", tipo: "nacional", pais: "BR" });
    setEditando(null);
    setMostrarForm(false);
  }

  async function salvar() {
    onErro?.(null);
    if (!form.data) { onErro?.("Informe a data"); return; }
    if (!form.nome.trim()) { onErro?.("Informe o nome do feriado"); return; }

    setSalvando(true);
    try {
      if (editando) {
        await apiService.put(`/configuracoes/feriados/${editando.id}`, form);
      } else {
        await apiService.post("/configuracoes/feriados", form);
      }
      carregar();
      resetForm();
    } catch (e) {
      onErro?.(e.message || "Erro ao salvar feriado");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(feriado) {
    if (!window.confirm(`Remover feriado "${feriado.nome}"?`)) return;
    try {
      await apiService.delete(`/configuracoes/feriados/${feriado.id}`);
      carregar();
    } catch (e) {
      onErro?.(e.message || "Erro ao remover");
    }
  }

  function abrirEdicao(feriado) {
    setEditando(feriado);
    setForm({
      data: feriado.data?.slice(0, 10) || "",
      nome: feriado.nome,
      tipo: feriado.tipo,
      pais: feriado.pais || "",
    });
    setMostrarForm(true);
  }

  const tiposFeriado = [
    { id: "nacional", label: "Nacional" },
    { id: "estadual", label: "Estadual" },
    { id: "municipal", label: "Municipal" },
    { id: "sindical", label: "Sindical" },
    { id: "empresa", label: "Empresa" },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          {feriados.length} feriado(s) cadastrado(s)
        </div>
        {!mostrarForm && (
          <button onClick={() => setMostrarForm(true)}
            style={{ ...s.btn(true), padding: "8px 16px", fontSize: 12 }}>
            + Adicionar feriado
          </button>
        )}
      </div>

      {mostrarForm && (
        <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 14 }}>
            {editando ? "EDITAR FERIADO" : "NOVO FERIADO"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10,
                        marginBottom: 12 }}>
            <div>
              <label style={s.label}>DATA *</label>
              <input type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                style={s.input} />
            </div>
            <div>
              <label style={s.label}>NOME *</label>
              <input type="text" value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Natal, Independência..."
                style={s.input} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                        marginBottom: 14 }}>
            <div>
              <label style={s.label}>TIPO</label>
              <select value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                style={{ ...s.input, appearance: "none" }}>
                {tiposFeriado.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.label}>PAÍS (OPCIONAL)</label>
              <input type="text" value={form.pais}
                onChange={e => setForm(f => ({ ...f, pais: e.target.value.toUpperCase() }))}
                placeholder="BR, PT, US..."
                maxLength={3}
                style={s.input} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={resetForm} disabled={salvando}
              style={{ ...s.btn(false), padding: "8px 16px" }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ ...s.btn(true), padding: "8px 16px",
                       opacity: salvando ? 0.5 : 1 }}>
              {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>
          Carregando feriados...
        </div>
      ) : feriados.length === 0 ? (
        <div style={{ ...s.card, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📅</div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
            Nenhum feriado cadastrado
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Cadastre os feriados do seu calendário para que o sistema
            calcule corretamente as horas excepcionais.
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {feriados.map((f, i) => (
            <div key={f.id} style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 120px 120px",
              gap: 12, alignItems: "center",
              padding: "12px 18px",
              borderBottom: i < feriados.length - 1 ? `1px solid ${C.border}22` : "none",
            }}>
              <div style={{ fontSize: 12, color: C.accent,
                            fontFamily: "'IBM Plex Mono',monospace" }}>
                {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <div style={{ fontSize: 12, color: C.text }}>{f.nome}</div>
              <div>
                <span style={{ ...s.tag(C.accent), fontSize: 9 }}>
                  {f.tipo}
                </span>
                {f.pais && (
                  <span style={{ ...s.tag("#a855f7"), fontSize: 9, marginLeft: 4 }}>
                    {f.pais}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => abrirEdicao(f)}
                  style={{ background: "transparent", border: "none",
                           color: C.accent, fontSize: 11, cursor: "pointer",
                           fontFamily: "inherit", padding: 0 }}>
                  Editar
                </button>
                <button onClick={() => remover(f)}
                  style={{ background: "transparent", border: "none",
                           color: "#ef4444", fontSize: 11, cursor: "pointer",
                           fontFamily: "inherit", padding: 0 }}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}