"use client";
export function DocumentSignatures({
  school,
  style,
}: {
  school: any;
  style: any;
}) {
  if (style?.showSignatures === false) return null;
  const labels = style?.signatureLabels || [];
  return (
    <footer
      className="sd-signatures document-saved-signatures"
      data-has-signature-images={
        !!(
          school?.signature ||
          school?.teacherSignature ||
          school?.staffSignature ||
          school?.stamp
        )
      }
    >
      {labels.map((label: string, i: number) => {
        const last = i === labels.length - 1,
          signature = last
            ? school?.signature
            : i === 0
              ? school?.teacherSignature
              : school?.staffSignature;
        return (
          <div key={i}>
            <div className="sd-sign-image-row">
              {signature && <img src={signature} alt={label + " signature"} />}{" "}
              {last && school?.stamp && (
                <img
                  className="sd-stamp"
                  src={school.stamp}
                  alt="Official school stamp"
                />
              )}
            </div>
            <div className="sd-sign-line" />
            {label}
            {last && (
              <small>{school?.principalName || school?.signatoryName}</small>
            )}
          </div>
        );
      })}
    </footer>
  );
}
