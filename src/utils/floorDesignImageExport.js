import { formatExportDate } from './exportShared.js';
import { buildFloorDesignLayoutModel } from './floorDesignLayoutModel.js';
import { buildWeddingFloorDesignSvg } from './floorDesignSvgBuilder.js';
import { buildWeddingFloorLayoutModel } from './weddingFloorPrintLayout.js';

export const FLOOR_DESIGN_PNG_SIZE = {
  width: 2480,
  height: 3508,
};

export function buildFloorDesignFileNames(date = new Date()) {
  const exportDate = formatExportDate(date);
  const baseName = `婚禮桌次設計圖_${exportDate}`;

  return {
    baseName,
    png: `${baseName}.png`,
    svg: `${baseName}.svg`,
  };
}

export function buildFloorDesignSvgExport(state, options = {}) {
  const date = options.date ?? new Date();
  const layoutModel = options.layoutModel ?? buildFloorDesignLayoutModel(
    state,
    options.floorDesign ?? {}
  );
  const printModel = buildWeddingFloorLayoutModel(state, { ...options, date });
  const svg = buildWeddingFloorDesignSvg(layoutModel, {
    meta: printModel.meta,
    legendItems: printModel.legendItems,
  });

  return {
    svg,
    layoutModel,
    layoutSignature: layoutModel.layoutSignature,
    meta: printModel.meta,
    legendItems: printModel.legendItems,
    fileNames: buildFloorDesignFileNames(date),
  };
}

export function createFloorDesignSvgBlob(svg) {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export function renderFloorDesignPngBlob(svg, options = {}) {
  const size = {
    ...FLOOR_DESIGN_PNG_SIZE,
    ...(options.size ?? {}),
  };
  const background = options.background ?? '#fffaf3';

  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined'
  ) {
    return Promise.reject(new Error('PNG export requires a browser environment'));
  }

  return new Promise((resolve, reject) => {
    const svgBlob = createFloorDesignSvgBlob(svg);
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas 2D context is unavailable'));
          return;
        }

        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.drawImage(image, 0, 0, size.width, size.height);
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Canvas PNG encoding failed'));
              return;
            }
            resolve(blob);
          },
          'image/png',
          1
        );
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image could not be loaded for PNG export'));
    };

    image.src = url;
  });
}
