import { t } from "../../../../i18n/en.js";
import { Loader } from "../../../../components/Loader/Loader.js";
import { hasSession } from "../../../../lib/auth/tokenStore.js";
import { useAuth } from "../../AuthProvider.js";
import styles from "./UserMenu.module.css";

export function UserMenu() {
  const { user, logout } = useAuth();
  // A session can exist with no readable user yet: the rare start-up pause
  // between a stored refresh token and the first silent renewal filling in
  // the access token. Only a genuinely absent session renders nothing.
  if (!user) return hasSession() ? <Loader size="sm" /> : null;

  return (
    <div className={styles.menu}>
      <span className={styles.name}>{user.name}</span>
      <button type="button" className={styles.logout} onClick={() => void logout()}>
        {t("auth.logout")}
      </button>
    </div>
  );
}
