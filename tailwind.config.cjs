module.exports = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            fontFamily: [
              'Apple SD Gothic Neo', 'Malgun Gothic',
              'Segoe UI Symbol', 'Arial', 'sans-serif'
            ].join(', '),
            img: {
              borderRadius: '0.8em',
              margin: '0.1em',
            },
            ul: {
              paddingLeft: '0.1em',
            },
            ol: {
              marginTop: '0.4em',
              marginBottom: '0.4em',
              marginLeft: '1.2em',
              paddingLeft: '0.15em',
            },
            code: {
              backgroundColor: '#f5f5f5',
              color: '#333',
              padding: '0.11em 0.32em',
              borderRadius: '0.3em',
              fontSize: '0.97em',
            },
            pre: {
              backgroundColor: '#fafafa',
              color: '#222',
              padding: '0.7em',
              borderRadius: '0.7em',
              fontSize: '0.96em',
              marginTop: '0.4em',
              marginBottom: '0.4em',
            },
            a: {
              color: '#009695',
              textDecoration: 'underline',
              fontWeight: '500',
              transition: 'color 0.16s',
            },
            'a:hover': {
              color: '#08786b',
            },
            hr: {
              margin: '0.4em 0',
              borderColor: '#e5e7eb',
            },
            table: {
              margin: '0.4em 0',
              borderCollapse: 'collapse',
            },
            blockquote: {
              fontStyle: 'italic',
              borderLeft: '0px solid #dadada',
              color: '#555',
              backgroundColor: '#fafafa',
              borderRadius: 'var(--nav-radius)',
              overflow: 'hidden',
              quotes: 'none',
              '& p:first-of-type::before': { content: 'none' },
              '& p:last-of-type::after': { content: 'none' },
            },
            'th, td': {
              border: '1px solid #e3e3e3',
              padding: '0.38em 0.7em',
            },
          },
        },
      },
    },
  },
};
