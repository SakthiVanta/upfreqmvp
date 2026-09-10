'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Bot,
  Warehouse,
  Radio,
  Search,
  CheckCircle2,
  FileCode,
  Download,
  Loader2,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { RegistryAssetRecord } from '@/lib/assets/registry';
import { ModalShell } from '@/components/ui/modal-shell';
import { useToast } from '@/components/ui/toast';

export default function AssetRegistryPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<RegistryAssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'robot_mobile' | 'environment' | 'sensor'>('all');
  const [selectedAsset, setSelectedAsset] = useState<RegistryAssetRecord | null>(null);

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => setAssets(data.assets || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        a.assetId.toLowerCase().includes(q) ||
        (a.contract.asset.description && a.contract.asset.description.toLowerCase().includes(q));
      return matchType && matchQuery;
    });
  }, [assets, typeFilter, searchQuery]);

  const handleDownloadContract = (asset: RegistryAssetRecord) => {
    const yaml = `# UpFreq Semantic Asset Contract
asset:
  id: "${asset.contract.asset.id}"
  version: "${asset.contract.asset.version}"
  type: "${asset.contract.asset.type}"
  visibility: "${asset.contract.asset.visibility}"

runtime_requirements:
  ros_distribution: "${asset.contract.runtime_requirements.ros_distribution}"

dependencies:
  ros_packages: [${asset.contract.dependencies.ros_packages.join(', ')}]

frames:
  root: "${asset.contract.frames.root}"
  required: [${asset.contract.frames.required.join(', ')}]

validation:
  status: "${asset.contract.validation?.status || 'verified'}"
  physics_score: ${asset.physicsScore}
`;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upfreq_asset_contract_${asset.assetId}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded contract for ${asset.assetId}`);
  };

  return (
    <div className="space-y-8 font-sans pb-8">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight">
            Asset Registry
          </h1>
          <p className="text-sand-500 text-sm sm:text-base">
            Canonical versioned OpenUSD robots, environments, and sensor models with semantic contracts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full sm:w-56 pl-9 pr-8 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-500 hover:text-sand-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-sand-800 pb-2">
        {[
          { id: 'all', label: 'All Assets' },
          { id: 'robot_mobile', label: 'Robots' },
          { id: 'environment', label: 'Environments' },
          { id: 'sensor', label: 'Sensors' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id as any)}
            className={`py-1.5 px-3 font-bold text-xs cursor-pointer transition-colors ${
              typeFilter === tab.id
                ? 'bg-emerald-primary text-sand-950'
                : 'text-sand-400 hover:bg-sand-800 hover:text-sand-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="minimal-card p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="minimal-card p-12 text-center space-y-2">
          <Layers className="h-8 w-8 mx-auto text-sand-600" />
          <p className="font-bold text-sand-50">No Assets Found</p>
          <p className="text-sand-500 text-xs">Try clearing the search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const Icon =
              asset.type === 'robot_mobile'
                ? Bot
                : asset.type === 'environment'
                ? Warehouse
                : Radio;

            return (
              <div
                key={asset.id}
                className="minimal-card p-5 space-y-4 hover:border-sand-600 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 bg-sand-800 border border-sand-700 flex items-center justify-center font-bold text-emerald-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-sand-50 truncate max-w-44">
                          {asset.assetId}
                        </h3>
                        <span className="font-mono text-[10px] text-sand-500">v{asset.version}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 border border-sand-700 bg-sand-900 text-emerald-primary font-mono text-[10px] font-bold">
                      {asset.physicsScore}/100 Physics
                    </span>
                  </div>

                  <p className="text-xs text-sand-400 leading-relaxed line-clamp-2">
                    {asset.contract.asset.description}
                  </p>

                  <div className="space-y-1.5 text-[11px] pt-1">
                    <div className="flex justify-between text-sand-500">
                      <span>ROS Distribution:</span>
                      <span className="font-bold text-sand-300">
                        {asset.contract.runtime_requirements.ros_distribution}
                      </span>
                    </div>
                    <div className="flex justify-between text-sand-500">
                      <span>Root Frame:</span>
                      <span className="font-mono font-bold text-sand-300">
                        {asset.contract.frames.root}
                      </span>
                    </div>
                    <div className="flex justify-between text-sand-500">
                      <span>NVMe Cache:</span>
                      <span className="font-mono text-sand-400 text-[10px] truncate max-w-36">
                        {asset.nvmeCachePath}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-sand-800">
                  <button
                    onClick={() => setSelectedAsset(asset)}
                    className="flex-1 py-2 px-3 bg-sand-800 hover:bg-sand-700 text-sand-50 border border-sand-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileCode className="h-3.5 w-3.5" /> Inspect Contract
                  </button>
                  <button
                    onClick={() => handleDownloadContract(asset)}
                    className="p-2 border border-sand-700 hover:bg-sand-800 text-sand-300 hover:text-sand-50 cursor-pointer"
                    title="Download Semantic Contract"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset Contract Inspector Modal */}
      {selectedAsset && (
        <ModalShell
          onClose={() => setSelectedAsset(null)}
          title={`Asset Contract: ${selectedAsset.assetId}@${selectedAsset.version}`}
          icon={ShieldCheck}
          wide
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-sand-950 border border-sand-800 flex justify-between items-center flex-wrap gap-2">
              <div className="space-y-0.5">
                <span className="font-bold text-sand-50 text-sm">{selectedAsset.assetId}</span>
                <p className="text-[11px] text-sand-500">{selectedAsset.storageUri}</p>
              </div>
              <button
                onClick={() => handleDownloadContract(selectedAsset)}
                className="py-1.5 px-3 bg-emerald-primary text-sand-950 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Download Contract YAML
              </button>
            </div>

            <div className="p-4 bg-black border border-sand-800 font-mono text-[11px] text-sand-200 max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(selectedAsset.contract, null, 2)}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
