import React from 'react';
import { STATUS, STATUS_META } from '../utils/stockLogic';

const CLASS_BY_STATUS = {
  [STATUS.OK]: 'status-pill--ok',
  [STATUS.POR_AGOTARSE]: 'status-pill--warn',
  [STATUS.COMPRAR]: 'status-pill--danger'
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return <span className={`status-pill ${CLASS_BY_STATUS[status]}`}>{meta.label}</span>;
}
