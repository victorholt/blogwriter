'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAgentConfigs,
  updateAgentConfig,
  fetchModels,
  fetchAgentDefaults,
  fetchAdditionalInstructions,
  createAdditionalInstruction,
  updateAdditionalInstruction,
  deleteAdditionalInstruction,
} from '@/lib/admin-api';
import type {
  AgentConfig,
  ModelOption,
  AgentDefaultInstructions,
  AdditionalInstruction,
} from '@/lib/admin-api';
import {
  Save, Check, AlertCircle, Loader2, ChevronDown, Copy, Plus, Trash2, X,
} from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import Toggle from '@/components/ui/Toggle';
import EnhancedTextArea from '@/components/ui/EnhancedTextArea';
import Slider from '@/components/ui/Slider';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';

interface AgentModelsTabProps {
  token: string;
}

export default function AgentModelsTab({ token }: AgentModelsTabProps): React.ReactElement {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaults, setDefaults] = useState<Record<string, AgentDefaultInstructions>>({});
  const [loading, setLoading] = useState(true);

  // Accordion — one agent expanded at a time
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // Per-agent additional instructions (loaded lazily)
  const [additionalInstructions, setAdditionalInstructions] = useState<Record<string, AdditionalInstruction[]>>({});

  // Editing state
  const [agentEdits, setAgentEdits] = useState<Record<string, Partial<AgentConfig>>>({});
  const [agentSaveStatus, setAgentSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  // Sub-section toggles
  const [showDefaultsFor, setShowDefaultsFor] = useState<string | null>(null);
  const [showOverrideFor, setShowOverrideFor] = useState<string | null>(null);

  // Additional instruction snippet editing
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set());
  const [snippetEdits, setSnippetEdits] = useState<Record<number, { content?: string }>>({});
  const [snippetSaveStatus, setSnippetSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [newSnippet, setNewSnippet] = useState<{ agentId: string; content: string } | null>(null);
  const [newSnippetStatus, setNewSnippetStatus] = useState<'idle' | 'saving'>('idle');

  const modelGroups: SearchSelectGroup[] = Object.entries(
    models.reduce<Record<string, ModelOption[]>>((acc, m) => {
      (acc[m.provider] ??= []).push(m);
      return acc;
    }, {}),
  ).map(([provider, providerModels]) => ({
    label: provider,
    options: providerModels.map((m) => ({
      label: m.name,
      value: `openrouter/${m.id}`,
    })),
  }));

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const [agentsResult, modelsResult, defaultsResult] = await Promise.all([
        fetchAgentConfigs(token),
        fetchModels(token),
        fetchAgentDefaults(token),
      ]);
      setAgents(agentsResult.data ?? []);
      setModels(modelsResult.data ?? []);
      setDefaults(defaultsResult.data ?? {});
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load additional instructions when an agent is expanded
  useEffect(() => {
    if (!expandedAgentId) return;
    if (additionalInstructions[expandedAgentId]) return; // already loaded
    (async () => {
      const result = await fetchAdditionalInstructions(token, expandedAgentId);
      if (result.success && result.data) {
        setAdditionalInstructions((prev) => ({ ...prev, [expandedAgentId]: result.data! }));
      }
    })();
  }, [expandedAgentId, token, additionalInstructions]);

  // --- Agent helpers ---

  function getAgentValue(agentId: string, field: keyof AgentConfig): string {
    const edit = agentEdits[agentId];
    if (edit && field in edit) return edit[field] as string;
    const agent = agents.find((a) => a.agentId === agentId);
    return agent ? (agent[field] as string) ?? '' : '';
  }

  function setAgentValue(agentId: string, field: keyof AgentConfig, value: string): void {
    setAgentEdits((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  }

  async function handleToggleAgent(agentId: string): Promise<void> {
    const agent = agents.find((a) => a.agentId === agentId);
    if (!agent) return;
    const result = await updateAgentConfig(token, agentId, {
      modelId: agent.modelId,
      enabled: !agent.enabled,
    });
    if (result.success && result.data) {
      setAgents((prev) => prev.map((a) => (a.agentId === agentId ? result.data! : a)));
    }
  }

  async function handleSaveAgent(agentId: string): Promise<void> {
    setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'saving' }));
    const instructions = getAgentValue(agentId, 'instructions');
    const result = await updateAgentConfig(token, agentId, {
      modelId: getAgentValue(agentId, 'modelId'),
      temperature: getAgentValue(agentId, 'temperature'),
      maxTokens: getAgentValue(agentId, 'maxTokens'),
      ...(instructions !== undefined && { instructions: instructions || '' }),
    });

    if (result.success && result.data) {
      setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'saved' }));
      setAgents((prev) => prev.map((a) => (a.agentId === agentId ? result.data! : a)));
      setAgentEdits((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
      setTimeout(() => setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'idle' })), 2000);
    } else {
      setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'error' }));
      setTimeout(() => setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'idle' })), 3000);
    }
  }

  function handleCopyDefaultToOverride(agentId: string): void {
    const def = defaults[agentId];
    if (!def) return;
    setAgentValue(agentId, 'instructions', def.instructions);
    // Auto-open the override section so the user sees the copied text
    setShowOverrideFor(agentId);
  }

  // --- Accordion toggle ---

  function toggleAgent(agentId: string): void {
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
    setShowDefaultsFor(null);
    setShowOverrideFor(null);
    setExpandedSnippets(new Set());
    setNewSnippet(null);
  }

  // --- Snippet helpers ---

  function toggleSnippet(id: number): void {
    setExpandedSnippets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function getSnippetContent(snippet: AdditionalInstruction): string {
    const edit = snippetEdits[snippet.id];
    if (edit && 'content' in edit) return edit.content!;
    return snippet.content;
  }

  function setSnippetContent(id: number, value: string): void {
    setSnippetEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], content: value },
    }));
  }

  async function handleSaveSnippet(agentId: string, id: number): Promise<void> {
    const edit = snippetEdits[id];
    if (!edit) return;
    setSnippetSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    const result = await updateAdditionalInstruction(token, agentId, id, edit);
    if (result.success && result.data) {
      setSnippetSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setAdditionalInstructions((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] ?? []).map((s) => (s.id === id ? result.data! : s)),
      }));
      setSnippetEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTimeout(() => setSnippetSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 2000);
    } else {
      setSnippetSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setSnippetSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 3000);
    }
  }

  async function handleDeleteSnippet(agentId: string, id: number): Promise<void> {
    const result = await deleteAdditionalInstruction(token, agentId, id);
    if (result.success) {
      setAdditionalInstructions((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] ?? []).filter((s) => s.id !== id),
      }));
      setExpandedSnippets((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleCreateSnippet(): Promise<void> {
    if (!newSnippet || !newSnippet.content.trim()) return;
    setNewSnippetStatus('saving');
    const result = await createAdditionalInstruction(token, newSnippet.agentId, {
      title: 'Instruction',
      content: newSnippet.content.trim(),
    });
    if (result.success && result.data) {
      setAdditionalInstructions((prev) => ({
        ...prev,
        [newSnippet.agentId]: [...(prev[newSnippet.agentId] ?? []), result.data!],
      }));
      setNewSnippet(null);
      setNewSnippetStatus('idle');
    } else {
      setNewSnippetStatus('idle');
    }
  }

  // --- Model display name ---

  function getModelName(modelId: string): string {
    const cleanId = modelId.startsWith('openrouter/') ? modelId.slice('openrouter/'.length) : modelId;
    const model = models.find((m) => m.id === cleanId);
    return model?.name ?? cleanId;
  }

  if (loading) {
    return (
      <section className="settings-section">
        <div className="settings-loading">
          <Loader2 size={24} className="spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      {agents.map((agent) => {
        const isExpanded = expandedAgentId === agent.agentId;
        const isRequired = agent.agentId === 'blog-writer' || agent.agentId === 'brand-voice-analyzer';
        const status = agentSaveStatus[agent.agentId] ?? 'idle';
        const hasEdits = agent.agentId in agentEdits;
        const snippets = additionalInstructions[agent.agentId] ?? [];
        const agentDefault = defaults[agent.agentId];
        const showingDefaults = showDefaultsFor === agent.agentId;
        const showingOverride = showOverrideFor === agent.agentId;
        const overrideValue = getAgentValue(agent.agentId, 'instructions') || '';

        return (
          <div
            key={agent.agentId}
            className={`agent-card${isExpanded ? ' agent-card--expanded' : ''}${!agent.enabled && !isRequired ? ' agent-card--disabled' : ''}`}
          >
            {/* Collapsed header */}
            <button
              type="button"
              className="agent-card__header"
              onClick={() => toggleAgent(agent.agentId)}
            >
              <span className="agent-card__label">{agent.agentLabel}</span>
              <span className="agent-card__model-name">{getModelName(agent.modelId)}</span>
              {!agent.enabled && !isRequired && (
                <span className="agent-card__badge agent-card__badge--disabled">Disabled</span>
              )}
              {snippets.length > 0 && (
                <span className="agent-card__badge agent-card__badge--snippets">
                  +{snippets.length}
                </span>
              )}
              <ChevronDown
                size={16}
                className={`agent-card__chevron${isExpanded ? ' agent-card__chevron--open' : ''}`}
              />
            </button>

            {/* Expanded body */}
            {isExpanded && (
              <div className="agent-card__body">
                {/* Enable/disable toggle */}
                <div className="agent-card__toggle-row">
                  {!isRequired && (
                    <Toggle
                      checked={agent.enabled}
                      onChange={() => handleToggleAgent(agent.agentId)}
                      label="Enabled"
                    />
                  )}
                </div>

                {/* Model config */}
                <div className="settings-card__fields">
                  <div className="settings-field">
                    <label className="settings-field__label">Model</label>
                    <SearchSelect
                      value={getAgentValue(agent.agentId, 'modelId')}
                      onChange={(val) => setAgentValue(agent.agentId, 'modelId', val)}
                      groups={modelGroups}
                      placeholder="Select a model..."
                    />
                  </div>

                  <div className="settings-card__row">
                    <div className="settings-field">
                      <Slider
                        label="Temperature"
                        value={parseFloat(getAgentValue(agent.agentId, 'temperature')) || 0.7}
                        onChange={(val) => setAgentValue(agent.agentId, 'temperature', val.toFixed(1))}
                        min={0}
                        max={2}
                        step={0.1}
                      />
                    </div>
                    <div className="settings-field">
                      <label className="settings-field__label">Max Tokens</label>
                      <input
                        className="input"
                        type="number"
                        step="256"
                        min="256"
                        value={getAgentValue(agent.agentId, 'maxTokens')}
                        onChange={(e) => setAgentValue(agent.agentId, 'maxTokens', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Default Instructions (collapsible) */}
                {agentDefault && (
                  <div className="agent-defaults">
                    <button
                      type="button"
                      className="agent-defaults__toggle"
                      onClick={() => setShowDefaultsFor(showingDefaults ? null : agent.agentId)}
                    >
                      <ChevronDown
                        size={14}
                        className={`agent-card__chevron${showingDefaults ? ' agent-card__chevron--open' : ''}`}
                      />
                      Default Instructions
                      {agentDefault.isDynamic && (
                        <span className="agent-defaults__dynamic-badge">Dynamic</span>
                      )}
                    </button>
                    {showingDefaults && (
                      <div className="agent-defaults__content">
                        {agentDefault.isDynamic && (
                          <p className="agent-defaults__dynamic-note">
                            This agent&apos;s instructions are built dynamically at generation time. The template below shows the structure.
                          </p>
                        )}
                        <pre className="agent-defaults__code">{agentDefault.instructions}</pre>
                        <div className="agent-defaults__actions">
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => handleCopyDefaultToOverride(agent.agentId)}
                          >
                            <Copy size={13} />
                            Copy to Override
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Override Instructions (collapsible, collapsed by default) */}
                <div className="agent-defaults">
                  <button
                    type="button"
                    className="agent-defaults__toggle"
                    onClick={() => setShowOverrideFor(showingOverride ? null : agent.agentId)}
                  >
                    <ChevronDown
                      size={14}
                      className={`agent-card__chevron${showingOverride ? ' agent-card__chevron--open' : ''}`}
                    />
                    Override Instructions
                    {overrideValue && (
                      <span className="agent-defaults__dynamic-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                        Active
                      </span>
                    )}
                  </button>
                  {showingOverride && (
                    <div className="agent-defaults__content">
                      <p className="agent-defaults__dynamic-note">
                        Replaces default instructions entirely. Leave empty to use defaults.
                      </p>
                      <EnhancedTextArea
                        value={overrideValue}
                        onChange={(val) => setAgentValue(agent.agentId, 'instructions', val)}
                        placeholder="Leave empty to use default agent instructions..."
                        rows={4}
                        token={token}
                        enhanceEnabled
                        enhanceContext={`instructions for an AI agent named "${agent.agentLabel}" — should be clear, specific, and actionable`}
                      />
                    </div>
                  )}
                </div>

                {/* Additional Instructions */}
                <div className="agent-snippets">
                  <div className="agent-snippets__header">
                    <span className="settings-field__label">
                      Additional Instructions
                      {snippets.length > 0 && (
                        <span className="agent-card__badge agent-card__badge--snippets" style={{ marginLeft: 8 }}>
                          {snippets.length}
                        </span>
                      )}
                    </span>
                    <span className="settings-field__hint"> — appended to the prompt, does not override</span>
                  </div>

                  {snippets.map((snippet) => {
                    const isSnippetOpen = expandedSnippets.has(snippet.id);
                    const snippetStatus = snippetSaveStatus[snippet.id] ?? 'idle';
                    const hasSnippetEdits = snippet.id in snippetEdits;
                    const contentValue = getSnippetContent(snippet);

                    return (
                      <div key={snippet.id} className={`agent-snippet${isSnippetOpen ? ' agent-snippet--expanded' : ''}`}>
                        <button
                          type="button"
                          className="agent-snippet__header"
                          onClick={() => toggleSnippet(snippet.id)}
                        >
                          <span className="agent-snippet__excerpt">
                            {snippet.content.length > 100
                              ? snippet.content.slice(0, 100) + '...'
                              : snippet.content}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`agent-card__chevron${isSnippetOpen ? ' agent-card__chevron--open' : ''}`}
                          />
                        </button>

                        {isSnippetOpen && (
                          <div className="agent-snippet__body">
                            <EnhancedTextArea
                              value={contentValue}
                              onChange={(val) => setSnippetContent(snippet.id, val)}
                              rows={3}
                              token={token}
                              enhanceEnabled
                              enhanceContext={`additional instructions for an AI agent named "${agent.agentLabel}"`}
                            />
                            <div className="agent-snippet__actions">
                              <button
                                className="btn btn--ghost btn--danger btn--sm"
                                onClick={() => handleDeleteSnippet(agent.agentId, snippet.id)}
                              >
                                <Trash2 size={13} />
                                Delete
                              </button>
                              <button
                                className={`btn ${hasSnippetEdits ? 'btn--primary' : 'btn--outline'} btn--sm`}
                                onClick={() => handleSaveSnippet(agent.agentId, snippet.id)}
                                disabled={!hasSnippetEdits || snippetStatus === 'saving'}
                              >
                                {snippetStatus === 'saving' ? (
                                  <Loader2 size={13} className="spin" />
                                ) : snippetStatus === 'saved' ? (
                                  <Check size={13} />
                                ) : (
                                  <Save size={13} />
                                )}
                                {snippetStatus === 'saved' ? 'Saved' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* New snippet form */}
                  {newSnippet && newSnippet.agentId === agent.agentId ? (
                    <div className="agent-snippet agent-snippet--expanded agent-snippet--new">
                      <div className="agent-snippet__body">
                        <EnhancedTextArea
                          value={newSnippet.content}
                          onChange={(val) => setNewSnippet({ ...newSnippet, content: val })}
                          placeholder="Instructions to append to the agent's prompt..."
                          rows={3}
                          token={token}
                          enhanceEnabled
                          enhanceContext={`additional instructions for an AI agent named "${agent.agentLabel}"`}
                        />
                        <div className="agent-snippet__actions">
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => { setNewSnippet(null); setNewSnippetStatus('idle'); }}
                          >
                            <X size={13} />
                            Cancel
                          </button>
                          <button
                            className="btn btn--primary btn--sm"
                            onClick={handleCreateSnippet}
                            disabled={!newSnippet.content.trim() || newSnippetStatus === 'saving'}
                          >
                            {newSnippetStatus === 'saving' ? (
                              <Loader2 size={13} className="spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                            {newSnippetStatus === 'saving' ? 'Creating...' : 'Create'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setNewSnippet({ agentId: agent.agentId, content: '' })}
                      style={{ marginTop: 8 }}
                    >
                      <Plus size={13} />
                      Add Instruction
                    </button>
                  )}
                </div>

                {/* Footer: updated + save */}
                <div className="settings-card__footer">
                  <span className="settings-card__updated">
                    Updated: {new Date(agent.updatedAt).toLocaleString()}
                  </span>
                  <button
                    className={`btn ${hasEdits ? 'btn--primary' : 'btn--outline'}`}
                    onClick={() => handleSaveAgent(agent.agentId)}
                    disabled={status === 'saving'}
                  >
                    {status === 'saving' ? (
                      <Loader2 size={14} className="spin" />
                    ) : status === 'saved' ? (
                      <Check size={14} />
                    ) : status === 'error' ? (
                      <AlertCircle size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
