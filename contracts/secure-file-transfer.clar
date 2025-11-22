(impl-trait .sip010-ft-standard.sip010-ft-trait)

(define-data-var next-transfer-id uint u1)

(define-map transfers
  ((id uint))
  ((sender principal)
   (recipient principal)
   (file-hash (buff 32))
   (storage-uri (string-utf8 256))
   (encryption-scheme (string-ascii 32))
   (status (string-ascii 16)) ;; "open", "revoked", "received"
   (created-at uint)
   (expires-at (optional uint))))

;; Error codes
(define-constant err-not-found (err u100))
(define-constant err-unauthorized (err u101))
(define-constant err-invalid-status (err u102))

(define-read-only (get-transfer (id uint))
  (match (map-get? transfers { id: id })
    transfer (ok transfer)
    err-not-found))

(define-public (create-transfer
    (recipient principal)
    (file-hash (buff 32))
    (storage-uri (string-utf8 256))
    (encryption-scheme (string-ascii 32))
    (expires-at (optional uint)))
  (begin
    (asserts! (not (is-eq tx-sender recipient)) err-unauthorized)
    (let
      ((id (var-get next-transfer-id))
       (now (block-height)))
      (map-set transfers
        { id: id }
        { sender: tx-sender
          recipient: recipient
          file-hash: file-hash
          storage-uri: storage-uri
          encryption-scheme: encryption-scheme
          status: "open"
          created-at: now
          expires-at: expires-at })
      (var-set next-transfer-id (+ id u1))
      (ok id))))

(define-public (revoke-transfer (id uint))
  (match (map-get? transfers { id: id })
    transfer
      (if (and (is-eq (get sender transfer) tx-sender)
               (is-eq (get status transfer) "open"))
        (begin
          (map-set transfers { id: id }
            (merge transfer { status: "revoked" }))
          (ok true))
        err-unauthorized)
    err-not-found))

(define-public (mark-received (id uint))
  (match (map-get? transfers { id: id })
    transfer
      (if (and (is-eq (get recipient transfer) tx-sender)
               (is-eq (get status transfer) "open"))
        (begin
          (map-set transfers { id: id }
            (merge transfer { status: "received" }))
          (ok true))
        err-unauthorized)
    err-not-found))

(define-public (update-storage-uri (id uint) (new-uri (string-utf8 256)))
  (match (map-get? transfers { id: id })
    transfer
      (if (and (is-eq (get sender transfer) tx-sender)
               (is-eq (get status transfer) "open"))
        (begin
          (map-set transfers { id: id }
            (merge transfer { storage-uri: new-uri }))
          (ok true))
        err-unauthorized)
    err-not-found))

(define-public (extend-expiry (id uint) (new-expires-at (optional uint)))
  (match (map-get? transfers { id: id })
    transfer
      (if (is-eq (get sender transfer) tx-sender)
        (begin
          (map-set transfers { id: id }
            (merge transfer { expires-at: new-expires-at }))
          (ok true))
        err-unauthorized)
    err-not-found))
