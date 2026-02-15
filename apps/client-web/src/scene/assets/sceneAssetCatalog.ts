export interface SceneAssetSpec {
  id: string;
  url: string;
  critical: boolean;
  position: [number, number, number];
  scale: [number, number, number];
  renderBudget: {
    shadowCasters: number;
    shadowReceivers: number;
  };
  fallback: {
    position: [number, number, number];
    size: [number, number, number];
    color: string;
  };
}

export const sceneAssetCatalog: SceneAssetSpec[] = [
  {
    id: "office_shell",
    url: "/assets/office_shell.glb",
    critical: true,
    position: [0, 0, 0],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 0,
      shadowReceivers: 18
    },
    fallback: {
      position: [0, 0.05, 0],
      size: [10, 0.1, 10],
      color: "#36495e"
    }
  },
  {
    id: "prop_inbox",
    url: "/assets/props/inbox.glb",
    critical: false,
    position: [2.2, 0, -1.4],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 2,
      shadowReceivers: 2
    },
    fallback: {
      position: [2.2, 0.3, -1.4],
      size: [0.7, 0.6, 0.5],
      color: "#e58e2b"
    }
  },
  {
    id: "prop_task_board",
    url: "/assets/props/task_board.glb",
    critical: false,
    position: [1.2, 0, 2.0],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 2,
      shadowReceivers: 2
    },
    fallback: {
      position: [1.2, 0.8, 2.0],
      size: [1.5, 1.6, 0.2],
      color: "#3ba0d9"
    }
  },
  {
    id: "prop_delivery_shelf",
    url: "/assets/props/delivery_shelf.glb",
    critical: false,
    position: [-1.5, 0, 2.2],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 2,
      shadowReceivers: 2
    },
    fallback: {
      position: [-1.5, 0.75, 2.2],
      size: [1.2, 1.5, 0.45],
      color: "#6bbf73"
    }
  },
  {
    id: "prop_dev_desk",
    url: "/assets/props/dev_desk.glb",
    critical: false,
    position: [0.6, 0, 0.8],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 1,
      shadowReceivers: 2
    },
    fallback: {
      position: [0.6, 0.35, 0.8],
      size: [1.2, 0.7, 0.8],
      color: "#caa56b"
    }
  },
  {
    id: "prop_blocker_cone",
    url: "/assets/props/blocker_cone.glb",
    critical: false,
    position: [-0.6, 0, -0.4],
    scale: [1, 1, 1],
    renderBudget: {
      shadowCasters: 1,
      shadowReceivers: 1
    },
    fallback: {
      position: [-0.6, 0.35, -0.4],
      size: [0.4, 0.7, 0.4],
      color: "#d96a5c"
    }
  }
];
