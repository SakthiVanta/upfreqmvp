'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Save, FlaskConical } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { TestCase, TestCategory, SimEnvironmentPreset, TestAssertion } from '@/lib/testing/types';

interface CreateTestModalProps {
  onClose: () => void;
  onSave: (testCase: TestCase) => void;
}

export function CreateTestModal({ onClose, onSave }: CreateTestModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TestCategory>('custom');
  const [environment, setEnvironment] = useState<SimEnvironmentPreset>('grid');
  const [durationSec, setDurationSec] = useState<number>(5);
  const [commandType, setCommandType] = useState<TestCase['commandType']>('custom_script');

  const [assertions, setAssertions] = useState<TestAssertion[]>([
    {
      id: `a_${Date.now()}_1`,
      label: 'Maximum Position Error',
      metric: 'max_position_error_m',
      operator: '<=',
      targetValue: 0.05,
      unit: 'm',
    },
  ]);

  const [newAssertionLabel, setNewAssertionLabel] = useState('');
  const [newAssertionMetric, setNewAssertionMetric] = useState('');
  const [newAssertionOp, setNewAssertionOp] = useState<TestAssertion['operator']>('<=');
  const [newAssertionVal, setNewAssertionVal] = useState<string>('');
  const [newAssertionUnit, setNewAssertionUnit] = useState('m');

  const handleAddAssertion = () => {
    if (!newAssertionLabel.trim() || !newAssertionMetric.trim() || !newAssertionVal.trim()) return;
    setAssertions((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        label: newAssertionLabel.trim(),
        metric: newAssertionMetric.trim(),
        operator: newAssertionOp,
        targetValue: Number(newAssertionVal) || 0,
        unit: newAssertionUnit.trim(),
      },
    ]);
    setNewAssertionLabel('');
    setNewAssertionMetric('');
    setNewAssertionVal('');
  };

  const handleRemoveAssertion = (id: string) => {
    setAssertions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const newCase: TestCase = {
      id: `test_custom_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'User-defined custom simulation test case.',
      category,
      environment,
      durationSec: Math.max(durationSec, 1),
      commandType,
      commandParams: {},
      assertions,
    };
    onSave(newCase);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Create Custom Simulation Test Case" icon={FlaskConical} wide>
      <div className="space-y-4 text-xs font-sans text-sand-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="block text-sand-400 font-bold uppercase text-[10px]">Test Case Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lateral Slip Recovery at 2.0 m/s"
              className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sand-400 font-bold uppercase text-[10px]">Test Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            >
              <option value="kinematics">Kinematics & Reachability</option>
              <option value="velocity_braking">Velocity & Braking</option>
              <option value="collision_avoidance">Collision & Obstacle Avoidance</option>
              <option value="incline_stability">Incline & Stability</option>
              <option value="payload_capacity">Payload & Torque Margin</option>
              <option value="custom">Custom Scripted Test</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sand-400 font-bold uppercase text-[10px]">Simulation Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            >
              <option value="grid">Metric Precision Grid</option>
              <option value="warehouse">Logistics Warehouse</option>
              <option value="laboratory">Robotics Testbed Lab</option>
              <option value="incline_slope">15° Incline Slope</option>
              <option value="rough_terrain">Rough Terrain Elevation</option>
              <option value="empty">Empty USD Stage</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sand-400 font-bold uppercase text-[10px]">Execution Duration (seconds)</label>
            <input
              type="number"
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value) || 5)}
              min={1}
              max={60}
              className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sand-400 font-bold uppercase text-[10px]">Description & Test Objective</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe what physics conditions are evaluated..."
            className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary resize-y"
          />
        </div>

        {/* Assertion Builder */}
        <div className="space-y-2 pt-2 border-t border-sand-800">
          <label className="block text-sand-400 font-bold uppercase text-[10px]">
            Pass / Fail Assertion Criteria ({assertions.length})
          </label>

          <div className="space-y-1.5">
            {assertions.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-sand-950 border border-sand-800 rounded">
                <span className="font-semibold text-sand-200">
                  {a.label} (<span className="font-mono text-sand-400">{a.metric}</span>)
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-emerald-400">
                    {a.operator} {a.targetValue} {a.unit}
                  </span>
                  <button
                    onClick={() => handleRemoveAssertion(a.id)}
                    className="p-1 text-sand-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-2.5 bg-sand-950/60 border border-dashed border-sand-700 rounded items-end">
            <div className="sm:col-span-2 space-y-1">
              <span className="text-[10px] text-sand-500 font-bold">Assertion Label</span>
              <input
                type="text"
                value={newAssertionLabel}
                onChange={(e) => setNewAssertionLabel(e.target.value)}
                placeholder="e.g. Max Stopping Distance"
                className="w-full px-2 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-sand-500 font-bold">Metric Key</span>
              <input
                type="text"
                value={newAssertionMetric}
                onChange={(e) => setNewAssertionMetric(e.target.value)}
                placeholder="stopping_dist"
                className="w-full px-2 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-sand-500 font-bold">Target Value</span>
              <div className="flex items-center gap-1">
                <select
                  value={newAssertionOp}
                  onChange={(e) => setNewAssertionOp(e.target.value as any)}
                  className="px-1.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none"
                >
                  <option value="<=">&le;</option>
                  <option value=">=">&ge;</option>
                  <option value="==">==</option>
                  <option value="<">&lt;</option>
                  <option value=">">&gt;</option>
                </select>
                <input
                  type="number"
                  value={newAssertionVal}
                  onChange={(e) => setNewAssertionVal(e.target.value)}
                  placeholder="0.5"
                  className="w-full px-2 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
                />
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={handleAddAssertion}
                disabled={!newAssertionLabel.trim() || !newAssertionMetric.trim() || !newAssertionVal.trim()}
                className="w-full btn-secondary-light py-1.5 px-3 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Plus className="h-3 w-3 text-emerald-primary" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-sand-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs text-sand-400 hover:text-sand-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Save Test Case
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
