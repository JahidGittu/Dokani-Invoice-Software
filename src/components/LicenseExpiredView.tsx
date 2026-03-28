interface LicenseExpiredViewProps {
  shopName?: string;
  expiryDate?: string;
  annualFee?: number;
  ownerName?: string;
  supportPhone?: string;
  supportEmail?: string;
  reason?: string;
  onSignOut: () => Promise<void>;
}

export default function LicenseExpiredView({
  shopName,
  expiryDate,
  annualFee,
  ownerName,
  supportPhone,
  supportEmail,
  reason,
  onSignOut,
}: LicenseExpiredViewProps) {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <span className="material-symbols-outlined text-[28px]">storefront</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Dokani License Center</p>
            <h1 className="text-2xl font-black sm:text-3xl">লাইসেন্স মেয়াদ শেষ</h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary/10 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                    <span className="material-symbols-outlined text-base">gpp_bad</span>
                    Access paused
                  </div>
                  <h2 className="text-2xl font-black sm:text-4xl">{shopName || "আপনার দোকান"} এখন সাময়িকভাবে বন্ধ আছে</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    আপনার সফটওয়্যারের লাইসেন্স রিনিউ না হওয়ায় সিস্টেমে প্রবেশ সাময়িকভাবে বন্ধ করা হয়েছে। রিনিউ করলেই আবার আগের সব ডাটা ও কাজ চালু হয়ে যাবে।
                  </p>
                </div>
                <div className="grid min-w-[220px] gap-3 rounded-2xl border border-border bg-background p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Expiry Date</p>
                    <p className="mt-1 text-lg font-black">{expiryDate || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Renewal Fee</p>
                    <p className="mt-1 text-lg font-black">৳{(annualFee || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">assignment</span>
                  <h3 className="text-lg font-black">কি করতে হবে</h3>
                </div>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <li className="flex gap-3"><span className="mt-0.5 material-symbols-outlined text-base text-primary">check_circle</span><span>System Admin বা support team-এর সাথে যোগাযোগ করুন।</span></li>
                  <li className="flex gap-3"><span className="mt-0.5 material-symbols-outlined text-base text-primary">payments</span><span>বাৎসরিক রিনিউয়াল পরিশোধ করুন।</span></li>
                  <li className="flex gap-3"><span className="mt-0.5 material-symbols-outlined text-base text-primary">database</span><span>রিনিউয়ের পর আগের সব ডাটা ঠিক আগের মতোই পাওয়া যাবে।</span></li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  <h3 className="text-lg font-black">লাইসেন্স তথ্য</h3>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                    <span>Shop Owner</span>
                    <span className="text-right font-bold text-foreground">{ownerName || "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                    <span>Software</span>
                    <span className="text-right font-bold text-foreground">Dokani Premium</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Reason</span>
                    <span className="max-w-[240px] text-right font-bold text-destructive">{reason || "License grace period ended."}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">support_agent</span>
                <h3 className="text-xl font-black">রিনিউয়ালের যোগাযোগ</h3>
              </div>
              <div className="space-y-3">
                <a href={`tel:${supportPhone || "01777615690"}`} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-accent">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
                    <p className="mt-1 font-black text-foreground">{supportPhone || "01777615690"}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary">call</span>
                </a>
                <a href={`mailto:${supportEmail || "admin@dokani.com.bd"}`} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-accent">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Email</p>
                    <p className="mt-1 break-all font-black text-foreground">{supportEmail || "admin@dokani.com.bd"}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary">mail</span>
                </a>
              </div>
              <div className="mt-5 rounded-2xl bg-primary p-4 text-primary-foreground">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/80">Note</p>
                <p className="mt-2 text-sm leading-6">Payment confirm হওয়ার পর System Admin panel থেকে আপনার access আবার active করে দেওয়া হবে।</p>
              </div>
            </div>

            <button
              onClick={() => void onSignOut()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              অন্য অ্যাকাউন্টে লগইন করুন
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}