class ProviderError(Exception):
    """Provider fetch or parse failure. Callers must fail honestly (no data
    written, watermark not advanced) rather than fabricate values."""


class NoDataError(ProviderError, ValueError):
    """The provider responded successfully but had no usable rows.

    This is distinct from transport and parsing failures because an individual
    symbol can legitimately have no data in a requested window.
    """
