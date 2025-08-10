export const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(amount);
};

export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Aujourd\'hui';
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else {
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  }
};

export const formatPercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const formatRemainingBudget = (allocated: number, spent: number): string => {
  const remaining = allocated - spent;
  if (remaining >= 0) {
    return `${remaining.toFixed(0)}€ restants`;
  } else {
    return `Dépassé de ${Math.abs(remaining).toFixed(0)}€`;
  }
};

export const getBudgetStatus = (percentage: number): 'safe' | 'warning' | 'danger' => {
  if (percentage >= 100) return 'danger';
  if (percentage >= 80) return 'warning';
  return 'safe';
};

export const getBudgetStatusColor = (status: 'safe' | 'warning' | 'danger'): string => {
  switch (status) {
    case 'safe': return '#059669';
    case 'warning': return '#f59e0b';
    case 'danger': return '#dc2626';
    default: return '#059669';
  }
};