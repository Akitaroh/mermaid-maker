/**
 * Atom-SampleLibrary (MermaidMaker generic samples)
 * 汎用 Mermaid サンプル集（フローチャート / 依存グラフ / 組織図 等）
 */

export type Sample = {
  id: string;
  title: string;
  description: string;
  text: string;
};

export const SAMPLES: Sample[] = [
  {
    id: 'flowchart-basic',
    title: '基本フローチャート',
    description: '開始→処理→判定→終了の典型フロー',
    text: `graph LR
    start((開始))
    proc[処理する]
    branch[条件OK?]
    yes[Yes 経路]
    no[No 経路]
    fin(((完了)))
    start --> proc
    proc --> branch
    branch -->|Yes| yes
    branch -->|No| no
    yes --> fin
    no --> fin
%% mm-pos: start=40,80 proc=180,80 branch=320,80 yes=460,30 no=460,140 fin=600,80`,
  },
  {
    id: 'dependency',
    title: '依存関係グラフ',
    description: 'モジュールやタスクの依存を可視化',
    text: `graph LR
    A[Module A]
    B[Module B]
    C[Module C]
    D[Module D]
    E[Module E]
    A --> B
    A --> C
    B --> D
    C --> D
    D --> E
%% mm-pos: A=40,80 B=200,30 C=200,140 D=380,80 E=540,80`,
  },
  {
    id: 'organization',
    title: '組織図',
    description: '階層構造の可視化',
    text: `graph TD
    CEO(((CEO)))
    CTO((CTO))
    COO((COO))
    Eng[Engineering]
    Prod[Product]
    Ops[Operations]
    CEO --> CTO
    CEO --> COO
    CTO --> Eng
    CTO --> Prod
    COO --> Ops
%% mm-pos: CEO=300,40 CTO=180,140 COO=420,140 Eng=80,240 Prod=280,240 Ops=420,240`,
  },
  {
    id: 'state-machine',
    title: '状態遷移（汎用）',
    description: 'ノード形状で状態を表現する例',
    text: `graph LR
    idle((Idle))
    running((Running))
    paused((Paused))
    done(((Done)))
    idle -->|start| running
    running -->|pause| paused
    paused -->|resume| running
    running -->|finish| done
%% mm-pos: idle=40,80 running=200,80 paused=200,200 done=380,80`,
  },
];

export function getSample(id: string): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
