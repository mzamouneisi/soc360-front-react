# DOC_PARAM_CONGES — Paramétrage des congés et soldes

Documentation des tables `leave_config`, `leave_lot`, `leave_movement` et du moteur de
calcul des droits (CP / RTT) du backend `soc360-back-java`.

- Migrations Flyway : `V167__leave_balances.sql`, `V168__rtt_eligibility_on_user.sql`.
- Service : `com.soc360.leave.LeaveService`
- Contrôleur : `com.soc360.leave.LeaveController` (`/api/leave`)
- Écrans front : `LeaveSettings.tsx` (paramétrage) et `LeaveBalances.tsx` (soldes/lots/mouvements).

---

## 1. Vue d'ensemble

| Table | Rôle | Granularité |
|---|---|---|
| `leave_config` | Règles de droits (paramétrage) | 1 ligne par société + type + date d'effet |
| `leave_lot` | Lots de droits acquis (soldes par lot) | 1 ligne par consultant + type + config + période |
| `leave_movement` | Journal des mouvements de solde (ledger) | 1 ligne par événement (+/-) |

Le solde affiché est la **somme des `leave_movement.quantity`** ; les `leave_lot` suivent le
`remaining` de chaque lot (consommation FIFO/FEFO, expiration).

Tables annexes :

- `public_holiday` : jours fériés légaux (par pays/date).
- `company_holiday` : jours fériés/fermetures propres à une société.
- `leave_eligibility` : présente en base mais **non utilisée** par le service actuel ;
  l'éligibilité RTT est portée par `user_account.rtt_eligible` / `rtt_eligible_date` (V168).

---

## 2. `leave_config` — paramétrage

Clé d'unicité : **`(company_id, leave_type, effective_date)`**.

```sql
UNIQUE (company_id, leave_type, effective_date)
```

Colonnes principales :

| Colonne | Sens |
|---|---|
| `company_id` | société propriétaire |
| `leave_type` | `CP` ou `RTT` |
| `effective_date` | date d'effet de cette version de configuration |
| `active` | version active ou non |
| `accrual_amount` | **« Quantité acquise »** (montant par période) |
| `accrual_frequency` | `MONTHLY`, `YEARLY`, `ONCE` |
| `credit_month` / `credit_day` | date de crédit (YEARLY/MONTHLY) |
| `acquisition_start/end_month/day` | fenêtre pendant laquelle le droit est acquis |
| `usage_start/end_month/day` | fenêtre d'utilisation |
| `expiration_months` | expiration d'un lot, en mois après le crédit |
| `carryover_max`, `carryover_expiration_months` | report (stockés, **non générés** par le moteur actuel) |
| `negative_limit` | seuil de solde négatif autorisé |

### Versionnement

- `LeaveService.saveConfig` fait un **find-or-create** sur `(soc, leave_type, effective_date)` :
  - **même type + même date** → la ligne existante est **mise à jour** (pas de doublon) ;
  - **date différente** (ou type différent) → **nouvelle ligne**.
- C'est la raison pour laquelle une société peut avoir plusieurs lignes : ce sont des
  **versions** (historique de paramétrage), pas des doublons.
- Aucune suppression n'est exposée par l'API (seulement `GET`/`POST /api/leave/configs`).

### Configuration active à une date

`activeConfig(soc, type, date)` prend la ligne **`active = true`** dont
`effective_date <= date`, triée par `effective_date DESC` (la plus récente gagne).

```java
findFirstBySocIdAndLeaveTypeAndActiveTrueAndEffectiveDateLessThanEqualOrderByEffectiveDateDesc(...)
```

Une ancienne version reste donc utilisée pour les dates qui la précèdent dans le temps.

---

## 3. `leave_lot` — lots de droits acquis

Clé d'unicité : **`(consultant_id, leave_type, config_id, period_key)`**.

| Colonne | Sens |
|---|---|
| `company_id`, `consultant_id` | société et consultant |
| `leave_type` | `CP` / `RTT` |
| `config_id` | configuration ayant produit le lot |
| `period_key` | période (`2026-11` en mensuel, `2026` en annuel, date en `ONCE`, `ADJ-...` en ajustement) |
| `quantity` | montant acquis (figé à la création, copie de `accrual_amount`) |
| `remaining` | reste disponible sur le lot |
| `credit_date` | date de crédit |
| `acquisition_start/end`, `usage_start/end` | fenêtres recopiées de la config |
| `expiration_date` | `credit_date + expiration_months` si défini |

### Génération (paresseuse)

`ensureLots(consultant, type, dateReference)` est appelé lors du calcul de solde / des lots :

1. prend la config active à `dateReference` ;
2. part de `max(effective_date, hire_date)` (et de la date d'éligibilité RTT pour `RTT`) ;
3. génère les lots manquants jusqu'à `dateReference` :
   - `MONTHLY` : un lot par mois (`period_key = yyyy-MM`, crédit à `credit_day`) ;
   - `YEARLY` : un lot par an (`period_key = yyyy`) ;
   - `ONCE` : un seul lot.
4. N'insère que si le lot n'existe pas déjà (idempotent via la clé unique) et écrit un
   mouvement `ACCRUAL` associé.

Conséquences importantes :

- Les lots ne sont **pas recalculés rétroactivement** : `quantity` est figée à la création.
- Changer `accrual_amount` ne modifie **pas** les lots déjà générés.
- La génération repart de la date d'effet de la **config la plus récente** ; le moteur est
  incrémental, il ne rejoue pas tout l'historique à chaque calcul.

---

## 4. `leave_movement` — journal des mouvements

Table **append-only** : c'est la source de vérité du solde. Aucune ligne n'est modifiée ni
supprimée lors d'un changement de configuration.

| Colonne | Sens |
|---|---|
| `company_id`, `consultant_id`, `leave_type` | périmètre |
| `movement_type` | `ACCRUAL`, `CONSUMPTION`, `REGULARIZATION`, `EXPIRATION`, `CARRYOVER`, `ADJUSTMENT`, `CORRECTION` |
| `quantity` | signé : `+` acquisition/régularisation, `-` consommation/expiration |
| `balance_before` / `balance_after` | solde avant/après |
| `movement_date` | date/heure du mouvement |
| `lot_id` | lot impacté (si applicable) |
| `expiration_date` | échéance du lot au moment du mouvement |
| `origin` | `AUTO`, `MANUAL`, `ABSENCE_VALIDATION` |
| `reason` | libellé lisible |
| `config_id` / `config_effective_date` | **traçabilité** : config active lors du mouvement |
| `unavailability_id` | absence liée (intégration indisponibilités) |
| `operation_key` | **idempotence** (unique) : évite les doubles écritures |
| `parent_movement_id` | lien de correction/annulation |
| `actor_user_id` | utilisateur à l'origine du mouvement |

Le solde courant est :

```java
sum(leave_movement.quantity) pour (consultant, type)
```

Le solde à une date de référence filtre les mouvements dont `movement_date <= date`.

---

## 5. Flux du moteur

### Calcul du solde (`balanceFor`)

1. `ensureLots` : génère les lots manquants jusqu'à la date de référence.
2. `ensureExpirations` : pour chaque lot expiré (`expiration_date <= date`) encore positif,
   met `remaining = 0` et écrit un mouvement `EXPIRATION` (négatif, idempotent `exp-<lotId>`).
3. Agrège les mouvements jusqu'à la date : acquis (`ACCRUAL`, `CARRYOVER`), consommé
   (`CONSUMPTION`), expiré (`EXPIRATION`), ajustements (`ADJUSTMENT`, `REGULARIZATION`,
   `CORRECTION`), et le solde total.

### Consommation (`consume`, FEFO)

- Trie les lots avec `remaining > 0` par `expiration_date` croissante, puis `credit_date`, puis `id`
  (premier expiré, premier sorti).
- Décrémente `remaining` de chaque lot et écrit un mouvement `CONSUMPTION` négatif par lot.
- `operation_key` = `<préfixe>-<lotId>` (idempotent).

### Ajustement manuel (`adjust`)

- Quantité `>= 0` : crée un lot `ADJ-<millis>` (`config_id = null`) + mouvement `ADJUSTMENT`.
- Quantité `< 0` : consommation `ADJUSTMENT` via `consume`.

### Intégration des absences

- Validation d'une absence : `consumeForAbsence` (contrôle du `negative_limit`, consommation
  `CONSUMPTION` avec `origin = ABSENCE_VALIDATION`).
- Annulation/invalidation : `regularizeForAbsence` ré-incrémente les lots et écrit des
  mouvements `REGULARIZATION`.

---

## 6. Réponses aux questions fréquentes

### Pourquoi plusieurs lignes dans `leave_config` pour une même société ?

Parce que la clé est `(company_id, leave_type, effective_date)`. Il y a une ligne par
**type de congé** (`CP`, `RTT`) et par **date d'effet**. Enregistrer avec une nouvelle date
crée une nouvelle version. Avec la même date + même type, la ligne est modifiée.

### Changer un paramètre impacte-t-il `leave_lot` / `leave_movement` ?

- **Non, pas immédiatement** : `saveConfig` n'écrit que dans `leave_config`.
- Les lots futurs seront créés **à partir de la date d'effet** de la nouvelle config, lors du
  prochain calcul de solde (`ensureLots`).
- Les **lots déjà créés** gardent leur `quantity` d'origine (copiée à la création).
- Les **mouvements existants** ne sont jamais modifiés ni supprimés.

### Que deviennent les anciennes configurations ?

- Elles **restent en base** (historique) et continuent de servir pour les dates antérieures à
  la nouvelle `effective_date`.
- Pour neutraliser une version, on peut la passer `active = false` ; elle est alors ignorée par
  `activeConfig`, mais les lots/mouvements déjà produits restent.
- Si une config est référencée par des lots/mouvements (`config_id`), la supprimer en base
  échouerait (contraintes de clé étrangère) ; il n'y a de toute façon pas d'API de suppression.

### Points d'attention

1. **Pas de recalcul rétroactif** : pour corriger un solde déjà généré, utiliser un ajustement
   (`ADJUSTMENT`) ou une correction manuelle des données, pas un simple changement de config.
2. **Nouvelle version en milieu de période** : la clé unique des lots inclut `config_id`. Si la
   date de crédit de la nouvelle config tombe dans une période déjà créditée par l'ancienne,
   un second lot peut être créé pour la même période (double acquisition). Préférer une date
   d'effet alignée sur le début de période (ou avant la date de crédit).
3. **`carryover_max` / `carryover_expiration_months`** sont stockés mais aucun mouvement
   `CARRYOVER` n'est généré par le moteur actuel.
4. `CARRYOVER` et `CORRECTION` existent dans l'enum et sont agrégés dans le solde, mais ne sont
   pas produits par le service actuel.
5. Le moteur est **incrémental** : les périodes antérieures ne sont générées que si un calcul
   antérieur les a déjà traitées.

### Activation / désactivation d'une configuration

`leave_config.active` porte l'état courant. Chaque changement d'état est journalisé dans
**`leave_config_activation`** : un événement par action, contenant **date**, **statut**
(`ACTIVATION` / `DESACTIVATION`) et **utilisateur** à l'origine (`user_id`).

| Colonne | Sens |
|---|---|
| `config_id` | configuration concernée |
| `action` | `ACTIVATION` ou `DESACTIVATION` |
| `action_date` | date/heure de l'action |
| `user_id` | utilisateur ayant effectué l'action (`NULL` = système) |

La configuration ne porte **pas** de colonnes `date_activation` / `date_desactivation` :
l'historique complet est dans cette table (affiché dans `LeaveSettings` sous forme
`Date | Statut | Utilisateur`).

---

## 7. API et droits

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/leave/configs?socId=` | lecture (membre de la société) |
| `POST` | `/api/leave/configs` | `RESPONSIBLE_SOC` |
| `POST` | `/api/leave/configs/{id}/active` | `RESPONSIBLE_SOC` (active/désactive) |
| `GET` | `/api/leave/eligibilities?leaveType=RTT` | lecture |
| `POST` | `/api/leave/eligibilities` | `RESPONSIBLE_SOC` |
| `GET` | `/api/leave/balance?consultantId=&date=` | membre / consultant lui-même |
| `GET` | `/api/leave/lots?consultantId=&leaveType=` | idem |
| `GET` | `/api/leave/movements?consultantId=&leaveType=&from=&to=` | idem |
| `POST` | `/api/leave/adjust` | `RESPONSIBLE_SOC` |

Isolation multi-société : `SecurityUtils.effectiveSocId(...)` / `requireSocAccess(...)`.

---

## 8. Requêtes SQL utiles

Configurations d'une société :

```sql
SELECT id, leave_type, effective_date, accrual_amount, accrual_frequency, active,
       expiration_months, negative_limit
FROM leave_config
WHERE company_id = :socId
ORDER BY leave_type, effective_date DESC;
```

Retrouver une valeur « Quantité acquise » à une date d'effet :

```sql
SELECT c.id, s.name AS societe, c.leave_type, c.effective_date, c.accrual_amount
FROM leave_config c
JOIN company s ON s.id = c.company_id
WHERE c.effective_date = DATE '2026-11-09';
```

Lots d'un consultant :

```sql
SELECT id, leave_type, config_id, period_key, quantity, remaining, credit_date, expiration_date
FROM leave_lot
WHERE consultant_id = :consultantId AND leave_type = 'CP'
ORDER BY credit_date, id;
```

Solde et journal :

```sql
SELECT COALESCE(SUM(quantity), 0) AS solde
FROM leave_movement
WHERE consultant_id = :consultantId AND leave_type = 'CP';

SELECT movement_type, quantity, balance_before, balance_after, movement_date,
       origin, reason, config_id, config_effective_date, operation_key
FROM leave_movement
WHERE consultant_id = :consultantId AND leave_type = 'CP'
ORDER BY movement_date DESC, id DESC;
```

Cohérence lot / mouvements (le `remaining` d'un lot doit correspondre à la somme des
mouvements liés à ce lot) :

```sql
SELECT l.id, l.period_key, l.quantity, l.remaining,
       COALESCE(SUM(m.quantity), 0) AS mouvement_net
FROM leave_lot l
LEFT JOIN leave_movement m ON m.lot_id = l.id
WHERE l.consultant_id = :consultantId AND l.leave_type = 'CP'
GROUP BY l.id, l.period_key, l.quantity, l.remaining
ORDER BY l.credit_date, l.id;
```

---

## 9. Tests

- `SocServiceTest` / `LeaveServiceTest` (moteur, lots, mouvements, ajustements) — voir
  `src/test/java/com/soc360/leave/`.
- Règle workspace : toute modification du service ou d'une règle doit mettre à jour ses tests
  unitaires et les exécuter (`c:/pgm/apache-maven-3.9.9/bin/mvn test`).
