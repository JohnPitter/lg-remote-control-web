import { TV } from '@/core/entities/TV';
import styles from './TVList.module.css';

interface TVListProps {
  tvs: TV[];
  onSelectTV: (tv: TV) => void;
  isLoading?: boolean;
}

export function TVList({ tvs, onSelectTV, isLoading = false }: TVListProps) {
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Procurando TVs na rede...</p>
      </div>
    );
  }

  if (tvs.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Nenhuma TV encontrada</p>
        <p className={styles.hint}>
          Certifique-se de que sua TV LG está ligada e conectada na mesma rede Wi-Fi
        </p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <h3 className={styles.title}>TVs Encontradas ({tvs.length})</h3>
      {tvs.map((tv) => (
        <button
          key={tv.id}
          className={styles.tvItem}
          onClick={() => onSelectTV(tv)}
        >
          <div className={styles.tvInfo}>
            <span className={styles.tvName}>{tv.name}</span>
            <span className={styles.tvAddress}>{tv.ipAddress}</span>
          </div>
          <span className={styles.arrow}>→</span>
        </button>
      ))}
    </div>
  );
}
