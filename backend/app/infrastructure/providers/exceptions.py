class ProviderError(Exception):
    """Provider fetch or parse failure. Callers must fail honestly (no data
    written, watermark not advanced) rather than fabricate values."""
