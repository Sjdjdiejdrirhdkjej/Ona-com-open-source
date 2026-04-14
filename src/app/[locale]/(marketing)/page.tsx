import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

type IIndexProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IIndexProps) {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function Index(props: IIndexProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div style={{ backgroundColor: '#f7f6f2' }}>
      <section className="flex flex-col items-center px-6 pb-0 pt-20 text-center">
        <h1
          className="max-w-3xl text-5xl leading-tight text-gray-950 md:text-6xl lg:text-7xl"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}
        >
          The platform for
          <br />
          background agents
        </h1>

        <p className="mt-6 max-w-lg text-lg text-gray-500 leading-relaxed">
          Run a team of AI software engineers in the cloud.
          <br />
          Orchestrated, governed, secured at the kernel.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up/"
            className="rounded-md bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Start for free
          </Link>
          <Link
            href="/about/"
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:border-gray-500"
          >
            Request a demo
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-6">
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{ aspectRatio: '16/9', minHeight: '420px' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #c8d8f0 0%, #d4c8e8 30%, #e8d0c0 60%, #f0dcc8 100%)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '10%',
              left: '15%',
              width: '40%',
              height: '60%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(120,160,220,0.55) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '20%',
              right: '10%',
              width: '35%',
              height: '50%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(200,150,120,0.45) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: '10%',
              left: '30%',
              width: '30%',
              height: '40%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(160,130,200,0.4) 0%, transparent 70%)',
              filter: 'blur(35px)',
            }}
          />

          <div className="absolute bottom-10 left-1/2 w-80 -translate-x-1/2 space-y-2">
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}
            >
              <span className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-green-400" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Weekly digest</p>
                <p className="text-xs text-gray-500">Identify files with most change...</p>
              </div>
            </div>
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}
            >
              <span className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-orange-400" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Implement prompts API</p>
                <p className="text-xs text-gray-500">Working...</p>
              </div>
            </div>
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}
            >
              <span className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-orange-400" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Add command palette</p>
                <p className="text-xs text-gray-500">Queued</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center px-6 pb-20 pt-8">
        <div
          className="flex items-center gap-3 rounded-full px-5 py-3 text-sm text-white"
          style={{ backgroundColor: '#1a1a2e' }}
        >
          <span
            className="size-5 flex-shrink-0 rounded-full"
            style={{ background: 'linear-gradient(135deg, #7b68ee, #9370db)' }}
          />
          <span>Background Agents virtual summit. RSVP now</span>
          <span className="ml-1">→</span>
        </div>
      </div>
    </div>
  );
}
